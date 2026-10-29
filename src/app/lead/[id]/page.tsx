import { redirect } from "next/navigation";

/**
 * The approved Meta template lead_assignment_confirmed opens /lead/<id>
 * ("Abrir o Lead"), with a literal "{{id}}" before the id as it was
 * registered: the lead lives at /leads/<id>.
 * The new_lead_broker offer uses that same lead-id URL parameter. Keep this
 * redirect centralized so /leads/<id> can verify a timed-out offer before its
 * normal broker ownership check, without exposing lead data.
 */
export default async function LeadShortLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // Already decoded.
  }
  id = id.replace(/^\{\{[^}]*\}\}/, "").trim();
  redirect(id ? `/leads/${encodeURIComponent(id)}` : "/leads");
}
