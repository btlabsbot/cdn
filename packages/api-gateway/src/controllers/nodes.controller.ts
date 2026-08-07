import type { Request, Response, NextFunction } from "express";
import { registerNodeSchema, heartbeatSchema } from "@lynxnodes/shared";
import { nodeService } from "../services/node.service";

export function registerNode(req: Request, res: Response, next: NextFunction): void {
  const parsed = registerNodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  try {
    const node = nodeService.register(parsed.data);
    res.status(201).json(node);
  } catch (err) {
    next(err);
  }
}

export function listNodes(_req: Request, res: Response): void {
  res.json(nodeService.list());
}

export function getNode(req: Request, res: Response): void {
  const node = nodeService.getById(req.params.id);
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  res.json(node);
}

export function heartbeatNode(req: Request, res: Response): void {
  const parsed = heartbeatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const node = nodeService.heartbeat(req.params.id, parsed.data);
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  res.json(node);
}
