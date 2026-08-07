import { z } from "zod";

export const registerNodeSchema = z.object({
  hostname: z.string().min(1, "hostname is required"),
  region: z.string().min(1, "region is required"),
});

export const heartbeatSchema = z.object({
  status: z.enum(["online", "offline", "degraded"]),
  cacheHitRate: z.number().min(0).max(1),
  diskUsagePct: z.number().min(0).max(100).optional(),
  latencyMs: z.number().min(0).optional(),
});

export type RegisterNodeSchema = z.infer<typeof registerNodeSchema>;
export type HeartbeatSchema = z.infer<typeof heartbeatSchema>;
