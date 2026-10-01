import { redirect } from "next/navigation";

/**
 * The approved Meta template lead_assignment_confirmed opens /lead/<id>
 * ("Abrir o Lead"), with a literal "{{id}}" before the id as it was
 * registered: the lead lives at /leads/<id>.
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
