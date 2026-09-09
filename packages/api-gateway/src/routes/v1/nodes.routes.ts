import { Router, type RequestHandler } from "express";
import { registerNode, listNodes, getNode, heartbeatNode } from "../../controllers/nodes.controller";

export function createNodesRouter(requireAuth: RequestHandler, requireNodeAuth: RequestHandler): Router {
  const router = Router();

  router.post("/", requireNodeAuth, registerNode);
  router.get("/", requireAuth, listNodes);
  router.get("/:id", requireAuth, getNode);
  router.post("/:id/heartbeat", requireNodeAuth, heartbeatNode);

  return router;
}
