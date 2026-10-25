/**
 * "Unidade" e "WhatsApp" no visual Lite. Mesmas informações da aba atual: o estado da unidade (sem edição aqui, as
 * alterações ficam na Central de Distribuição) e o atalho para o WhatsApp pessoal.
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";

import styles from "./sections-lite.module.css";

type BranchInfo = { id: string; name: string; status: "active" | "inactive"; acceptingLeads: boolean; autoDistribute: boolean; createdAt: Date };

export function UnitLite({ branch }: { branch: BranchInfo | null }) {
  if (!branch) {
    return (
      <div className={styles.group}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <p className={styles.rowTitle}>Todas as unidades da corretora</p>
            <p className={styles.rowDescription}>
              A identidade da unidade continua em Filiais. Recebimento, auto-distribuição, filas, regras e elegibilidade são definidos em um único lugar: a Central de Distribuição.
            </p>
          </div>
        </div>
        <div className={styles.footer}>
          <Link href="/distribuicao?view=filas" className={styles.link}>
            Abrir a Central de Distribuição
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </div>
    );
  }
  const active = branch.status === "active";
  return (
    <div className={styles.group}>
      <div className={styles.row}>
        <div className={styles.rowText}>
          <p className={styles.rowTitle}>{branch.name}</p>
          <p className={styles.rowDescription}>Criada em {formatLiteDate(branch.createdAt, { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <span className={page.badge} data-tone={active ? "success" : undefined}>{active ? "Ativa" : "Inativa"}</span>
      </div>
      <div className={styles.row}>
        <div className={styles.rowText}>
          <p className={styles.rowTitle}>Configuração de distribuição</p>
          <p className={styles.rowDescription}>Esta tela mostra o estado da unidade; todas as alterações de recebimento e distribuição ficam na Central de Distribuição.</p>
        </div>
        <div className={styles.badges}>
          <span className={page.badge} data-tone={branch.acceptingLeads ? "success" : undefined}>{branch.acceptingLeads ? "Recebendo leads" : "Recebimento pausado"}</span>
          <span className={page.badge} data-tone={branch.autoDistribute ? "success" : undefined}>{branch.autoDistribute ? "Auto-distribuição ativa" : "Auto-distribuição pausada"}</span>
        </div>
      </div>
      <div className={styles.footer}>
        <Link href="/distribuicao?view=filas" className={page.button}>Abrir a Central de Distribuição</Link>
      </div>
    </div>
  );
}

export function WhatsappLite() {
  return (
    <div className={styles.group}>
      <div className={styles.row}>
        <div className={styles.rowText}>
          <p className={styles.rowTitle}>WhatsApp pessoal de atendimento</p>
          <p className={styles.rowDescription}>Conecte somente o número usado por você. A conexão é isolada por usuário e não altera a identidade da corretora.</p>
        </div>
        <Link href="/integrations/whatsapp" className={page.primaryButton}>Configurar meu WhatsApp</Link>
      </div>
    </div>
  );
}
