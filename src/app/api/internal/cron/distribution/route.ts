// Compatibility endpoint for the existing Coolify scheduler. New tasks should
// use /api/internal/jobs/distribution directly.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export { GET, POST } from "../../jobs/distribution/route";
