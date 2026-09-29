import { redirect } from "next/navigation";

/** "Atendimento" opens on its first section. */
export default function AtendimentoPage() {
  redirect("/atendimento/situacoes");
}
