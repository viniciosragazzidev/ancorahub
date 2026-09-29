// Compatibility endpoint for the Coolify scheduler. The outbound worker is
// implemented under /api/internal/jobs/whatsapp; keeping this alias avoids a
// deployment-time 404 while existing scheduler tasks are migrated.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export { GET, POST } from "../../jobs/whatsapp/route";
