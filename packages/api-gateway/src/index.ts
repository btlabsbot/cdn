import express, { Request, Response, NextFunction } from "express";
import { apiRouter } from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { loadConfig } from "./config/env";

const app = express();
const config = loadConfig();
const port = config.port;


function cors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin && config.corsOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
}

app.use(cors);
app.use(express.json({ limit: "1mb" }));
app.use("/api", apiRouter);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`[api-gateway] listening on :${port}`);
});
