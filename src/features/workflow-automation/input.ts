import { z } from "zod";

import { workflowNodeKinds, type WorkflowDefinition } from "./contracts";

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const workflowDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  nodes: z.array(z.object({
    id: z.string().trim().min(1).max(100),
    kind: z.enum(workflowNodeKinds),
    position: z.object({ x: z.number().finite(), y: z.number().finite() }),
    config: jsonObjectSchema,
  })).min(1).max(100),
  edges: z.array(z.object({
    id: z.string().trim().min(1).max(100),
    source: z.string().trim().min(1).max(100),
    target: z.string().trim().min(1).max(100),
    sourceHandle: z.string().trim().min(1).max(50).optional(),
    targetHandle: z.string().trim().min(1).max(50).optional(),
  })).max(200),
}) satisfies z.ZodType<WorkflowDefinition>;

export const workflowDraftInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1_000).nullable().optional(),
  definition: workflowDefinitionSchema,
});
