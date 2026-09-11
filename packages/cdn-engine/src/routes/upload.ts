import { Router, Request, Response, RequestHandler } from "express";
import multer from "multer";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import type { AssetStore } from "../storage/assetStore";
import { isSafeAssetFilename } from "../storage/assetStore";
import { resolveContentType } from "../storage/mime";
import type { AuthedRequest } from "../middleware/requireAuth";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

function buildUpload(tmpDir: string) {
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true, mode: 0o700 });
  return multer({
    // Disk storage: concurrent uploads spool to disk instead of piling up in RAM (OOM/DoS).
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, tmpDir),
      filename: (_req, file, cb) => {
        const ext = extname(file.originalname ?? "").slice(0, 16);
        cb(null, `upload-${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1, fields: 5, parts: 6, fieldSize: 1024 * 16 },
  });
}

function sanitizeFilename(name: string): string | null {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  const candidate = cleaned.length > 0 ? cleaned.slice(0, 255) : `file-${randomUUID().slice(0, 8)}`;
  // Null = rejected (reserved/traversal). Empty fallback above is the only auto-generated case.
  if (!isSafeAssetFilename(candidate)) return null;
  return candidate;
}

export function createUploadRouter(
  store: AssetStore,
  requireAuth: RequestHandler,
  uploadsDir: string
): Router {
  const router = Router();
  const upload = buildUpload(join(uploadsDir, ".tmp"));

  router.post("/upload", requireAuth, (req: AuthedRequest, res: Response) => {
    upload.single("file")(req, res, (err: unknown) => {
      const tmpPath = (req as Request & { file?: Express.Multer.File }).file?.path;
      const cleanupTmp = () => {
        if (tmpPath && existsSync(tmpPath)) {
          try {
            unlinkSync(tmpPath);
          } catch {
            // best-effort
          }
        }
      };

      if (err instanceof multer.MulterError) {
        cleanupTmp();
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: `File exceeds the maximum allowed size (${MAX_FILE_SIZE_BYTES} bytes)` });
          return;
        }
        res.status(400).json({ error: `Upload error: ${err.message}` });
        return;
      }
      if (err) {
        cleanupTmp();
        res.status(500).json({ error: "Unexpected error while uploading the file" });
        return;
      }

      const muiFile = (req as Request & { file?: Express.Multer.File }).file;
      if (!muiFile) {
        res.status(400).json({ error: "No file received (use the 'file' field in form-data)" });
        return;
      }

      const requestedRaw =
        typeof req.body?.filename === "string" && req.body.filename.trim().length > 0
          ? req.body.filename
          : muiFile.originalname;

      const finalName = sanitizeFilename(requestedRaw);
      if (!finalName) {
        cleanupTmp();
        res.status(400).json({ error: "Invalid filename (reserved name or path traversal detected)" });
        return;
      }

      let name = finalName;
      if (store.has(name)) {
        const ext = extname(name);
        const base = ext ? name.slice(0, -ext.length) : name;
        const suffixed = `${base}-${randomUUID().slice(0, 8)}${ext}`.slice(0, 255);
        if (!isSafeAssetFilename(suffixed)) {
          cleanupTmp();
          res.status(400).json({ error: "Invalid filename" });
          return;
        }
        name = suffixed;
      }

      let buffer: Buffer;
      try {
        buffer = readFileSync(muiFile.path);
      } catch (e) {
        cleanupTmp();
        console.error(`[cdn-engine] failed to read spooled upload: ${(e as Error).message}`);
        res.status(500).json({ error: "Failed to persist uploaded file" });
        return;
      } finally {
        cleanupTmp();
      }

      // Never trust req.file.mimetype from the client: sniff server-side so a
      // disguised HTML/SVG is still served with Content-Disposition: attachment.
      const contentType = resolveContentType(buffer, muiFile.mimetype);
      let meta;
      try {
        meta = store.save(name, contentType, buffer);
      } catch (e) {
        console.error(`[cdn-engine] failed to save upload: ${(e as Error).message}`);
        res.status(500).json({ error: "Failed to persist uploaded file" });
        return;
      }

      console.log(
        `[cdn-engine] file uploaded: ${JSON.stringify(meta.filename)} (${meta.size} bytes, ${meta.contentType})`
      );

      res.status(201).json({
        filename: meta.filename,
        url: `/${meta.filename}`,
        contentType: meta.contentType,
        size: meta.size,
        uploadedAt: meta.uploadedAt,
      });
    });
  });

  router.get("/upload", requireAuth, (_req: Request, res: Response) => {
    const files = store.list().map((meta) => ({
      filename: meta.filename,
      url: `/${meta.filename}`,
      contentType: meta.contentType,
      size: meta.size,
      uploadedAt: meta.uploadedAt,
    }));
    res.json({ files });
  });

  router.delete("/upload/:filename", requireAuth, (req: Request, res: Response) => {
    const { filename } = req.params;
    if (!isSafeAssetFilename(filename)) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }
    const deleted = store.delete(filename);
    if (!deleted) {
      res.status(404).json({ error: `File ${JSON.stringify(filename)} not found` });
      return;
    }

    console.log(`[cdn-engine] file deleted: ${JSON.stringify(filename)}`);
    res.status(200).json({ filename, deleted: true });
  });

  return router;
}
