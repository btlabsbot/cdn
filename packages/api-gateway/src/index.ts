import express from "express";
import { createApiRouter } from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { loadConfig } from "./config/env";

async function main(): Promise<void> {
  const app = express();
  const config = loadConfig();
  const port = config.port;

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && config.corsOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", await createApiRouter(config));
  // JSON 404 (instead of Express HTML default)
  app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });
  app.use(errorHandler);

  app.listen(port, () => {
    console.log(`[api-gateway] listening on :${port}`);
  });
}

main().catch((err) => {
  console.error("[api-gateway] fatal startup error:", (err as Error).message);
  process.exit(1);
});
