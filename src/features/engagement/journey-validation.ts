import { z } from "zod";
export const journeyUserIdSchema = z.string().trim().min(1).max(80);
export const journeyMissionSchema = z.object({
  id: z.string().min(1), kind: z.enum(["daily", "weekly", "team", "campaign"]), title: z.string().trim().min(1).max(160),
  description: z.string().max(1_000), metric: z.enum(["contacts.fast_coverage", "returns.cleared", "notes.coverage", "steps.coverage", "offers.fast_coverage", "contacts.days_on_time", "contacts.evidenced", "contacts.on_time", "sla.no_breach"]),
  target: z.number().int().positive(), bonusPoints: z.number().int().min(0).max(500), period: z.enum(["daily", "weekly", "campaign"]),
  audience: z.object({ branchIds: z.array(z.string().min(1)).optional(), supervisorIds: z.array(journeyUserIdSchema).optional(), dutyScheduleIds: z.array(z.string().min(1)).optional(), userIds: z.array(journeyUserIdSchema).optional() }),
  startsAt: z.iso.datetime().nullable(), endsAt: z.iso.datetime().nullable(), status: z.enum(["active", "inactive"]),
});
