import { Router, Request, Response, RequestHandler } from "express";
import multer from "multer";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import type { AssetStore } from "../storage/assetStore";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

/** Strips any character that isn't safe for a filename/URL. */
function sanitizeFilename(name: string): string {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : `file-${randomUUID().slice(0, 8)}`;
}

/**
 * Upload routes:
 *   POST   /upload            (multipart/form-data, field "file") — login required
 *     -> saves the file and returns its public URL at /:filename
 *   GET    /upload             -> lists files uploaded so far — login required
 *   DELETE /upload/:filename   -> deletes a file — login required
 */
export function createUploadRouter(store: AssetStore, requireAuth: RequestHandler): Router {
  const router = Router();

  router.post("/upload", requireAuth, (req: Request, res: Response) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: `File exceeds the maximum allowed size (${MAX_FILE_SIZE_BYTES} bytes)` });
          return;
        }
        res.status(400).json({ error: `Upload error: ${err.message}` });
        return;
      }
      if (err) {
        res.status(500).json({ error: "Unexpected error while uploading the file" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file received (use the 'file' field in form-data)" });
        return;
      }

      // Optional name sent by the client (field "filename"); otherwise
      // fall back to the uploaded file's original name.
      const requestedRaw =
        typeof req.body?.filename === "string" && req.body.filename.trim().length > 0
          ? req.body.filename
          : req.file.originalname;

      let finalName = sanitizeFilename(requestedRaw);

      // Avoid clobbering an existing file with the same name: if it's
      // already taken, prefix it with a short id instead of overwriting.
      if (store.has(finalName)) {
        const ext = extname(finalName);
        const base = ext ? finalName.slice(0, -ext.length) : finalName;
        finalName = `${base}-${randomUUID().slice(0, 8)}${ext}`;
      }

      const contentType = req.file.mimetype || "application/octet-stream";
      const meta = store.save(finalName, contentType, req.file.buffer);

      console.log(
        `[cdn-engine] file uploaded: "${meta.filename}" (${meta.size} bytes, ${meta.contentType}) — available at /${meta.filename}`
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
    const deleted = store.delete(filename);
    if (!deleted) {
      res.status(404).json({ error: `File "${filename}" not found` });
      return;
    }

    console.log(`[cdn-engine] file deleted: "${filename}"`);
    res.status(200).json({ filename, deleted: true });
  });

  return router;
}
