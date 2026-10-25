/** Troca de visão do WhatsApp no visual Lite: as mesmas visões e regras da navegação atual, em chips de link de 44px. */
import Link from "next/link";

import styles from "./whatsapp-lite.module.css";

export function WhatsAppHeadingLite({ active, canViewDirector }: { active: "oficial" | "diretoria" | "materiais"; canViewDirector: boolean }) {
  const views = [
    { id: "oficial", label: "Oficial (Meta)", href: "/integrations/whatsapp" },
    ...(canViewDirector ? [{ id: "diretoria", label: "Diretoria (WAHA)", href: "/integrations/whatsapp?visao=diretoria" }] : []),
    ...(canViewDirector ? [{ id: "materiais", label: "Materiais (grupos)", href: "/integrations/whatsapp?visao=materiais" }] : []),
  ];
  return (
    <div className={styles.head}>
      <nav aria-label="Canais WhatsApp">
        <ul className={styles.views}>
          {views.map((view) => (
            <li key={view.id}>
              <Link href={view.href} className={styles.view} aria-current={view.id === active ? "page" : undefined}>{view.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className={styles.intro}>Gerencie o número oficial de atendimento e, quando disponível, o número da diretoria para comunicação com corretores.</p>
    </div>
  );
}
