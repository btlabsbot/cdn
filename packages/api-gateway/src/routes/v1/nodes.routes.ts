import { Router, type RequestHandler } from "express";
import { registerNode, listNodes, getNode, heartbeatNode } from "../../controllers/nodes.controller";

/**
 * register/heartbeat stay public: those are called by cdn-engine nodes
 * reporting in, which don't have (and shouldn't need) an admin browser
 * session. list/getById power the dashboard, so they require login.
 */
export function createNodesRouter(requireAuth: RequestHandler): Router {
  const router = Router();

  router.post("/", registerNode);
  router.get("/", requireAuth, listNodes);
  router.get("/:id", requireAuth, getNode);
  router.post("/:id/heartbeat", heartbeatNode);

  return router;
}
