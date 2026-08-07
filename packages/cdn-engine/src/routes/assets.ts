import { Router, Request, Response } from "express";
import type { AssetStore } from "../storage/assetStore";

export function createAssetRouter(store: AssetStore): Router {
  const router = Router();

  router.get("/:filename", (req: Request, res: Response) => {
    const { filename } = req.params;

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
