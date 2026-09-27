import { redirect } from "next/navigation";

/** Compatibility route for bookmarks pointing at the former separate page. */
export default function WhatsAltIntegrationPage() {
  redirect("/integrations/whatsapp?visao=diretoria");
}
