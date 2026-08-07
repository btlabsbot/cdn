import { Router, Request, Response } from "express";
import type { AssetStore } from "../storage/assetStore";

/**
 * "Domain" router: serves an uploaded file directly by its name.
 * E.g. you uploaded "image.png" → it's reachable at GET /image.png with
 * its original Content-Type, like a mini static CDN.
 *
 * IMPORTANT: registered in server.ts AFTER /health, /upload and /proxy,
 * since it's a single-route catch-all (/:filename) and must not intercept
 * those fixed routes.
 */
export function createAssetRouter(store: AssetStore): Router {
  const router = Router();

  router.get("/:filename", (req: Request, res: Response) => {
    const { filename } = req.params;

    // Never allow escaping the uploads directory.
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }

    const asset = store.get(filename);
    if (!asset) {
      res.status(404).json({ error: `File "${filename}" not found` });
      return;
    }

    res.setHeader("Content-Type", asset.meta.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Cache", "ASSET");
    res.send(asset.buffer);
  });

  return router;
}
