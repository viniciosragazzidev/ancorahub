import { dpoFooterText, type DataProtectionOfficer } from "./dpo";

/**
 * Rodapé curto das páginas públicas: "Encarregado de dados: Nome, e-mail". O e-mail vira link de e-mail.
 * Sem encarregado cadastrado, não desenha nada.
 */
export function DpoFooter({ dpo, className }: { dpo: Pick<DataProtectionOfficer, "name" | "email"> | null | undefined; className?: string }) {
  const text = dpoFooterText(dpo);
  if (!text || !dpo) return null;
  return (
    <p className={`m-0px-4 py-3 text-center text-xs leading-5 text-(--text-secondary) ${className ?? ""}`} data-testid="dpo-footer">
      Encarregado de dados: {dpo.name.trim()},{" "}
      <a className="text-(--text-secondary) underline underline-offset-2" href={`mailto:${dpo.email.trim()}`}>{dpo.email.trim()}</a>
    </p>
  );
}
