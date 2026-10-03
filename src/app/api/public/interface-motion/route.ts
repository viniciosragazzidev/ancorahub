import { getSystemSetting } from "@/features/system-settings/queries";

// Public presentation preference only. No caller-selected keys or tenant data.
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const value = await getSystemSetting("feature_interface_motion_enabled");
    return Response.json({ enabled: value === undefined || value === "true" }, { headers });
  } catch {
    return Response.json({ enabled: false }, { status: 503, headers });
  }
}
