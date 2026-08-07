import { Router, type RequestHandler } from "express";
import { registerNode, listNodes, getNode, heartbeatNode } from "../../controllers/nodes.controller";

export function createNodesRouter(requireAuth: RequestHandler): Router {
  const router = Router();

  router.post("/", registerNode);
  router.get("/", requireAuth, listNodes);
  router.get("/:id", requireAuth, getNode);
  router.post("/:id/heartbeat", heartbeatNode);

  return router;
}
