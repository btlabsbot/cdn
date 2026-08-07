import express, { Request, Response, NextFunction } from "express";
import { apiRouter } from "./routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const port = parseInt(process.env.PORT ?? "3000", 10);

// Minimal CORS: lynx-hub runs on a different port (different origin as far
// as the browser is concerned), so without this the browser blocks every
// fetch() from the dashboard with a NetworkError before it even reaches us.
//
// The login cookie needs Access-Control-Allow-Credentials + an explicit
// (not wildcard) Allow-Origin — browsers refuse to send/accept cookies on
// a request whose CORS response says "Allow-Origin: *".
function cors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin) {
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
app.use(express.json());
app.use("/api", apiRouter);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`[api-gateway] listening on :${port}`);
});
