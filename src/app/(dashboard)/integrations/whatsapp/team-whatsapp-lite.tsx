"use client";

/**
 * WhatsApp da equipe (visão da diretoria em /integrations/whatsapp): quem está com o WhatsApp pessoal caído.
 * Faixa quando mais de 20% dos corretores estão sem WhatsApp, tabela Lite com quem caiu primeiro e gaveta com
 * a situação e as tentativas do vigia hoje. "Pedir para reconectar" confirma depois do servidor (FEEDBACK.md, nível 1).
 */
import { useMemo, useState } from "react";
import Link from "next/link";

import { LiteActionButton, LiteMenu } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { ActionNoticeLine, useActionNotice } from "@/components/lite/feedback/action-notice";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { pedirReconexaoAction } from "@/features/whatsapp-equipe/actions";
import { faixaWhatsAppEquipe, semWhatsApp, SITUACAO_VIEW, type LinhaWhatsAppEquipe } from "@/features/whatsapp-equipe/situacao";

import styles from "./whatsapp-lite.module.css";

export type TeamWhatsAppServices = { pedirReconexao: (corretorId: string) => Promise<{ success: true } | { success: false; error: string }> };

const defaultServices: TeamWhatsAppServices = { pedirReconexao: pedirReconexaoAction };

function quando(value: string | null) {
  return formatLiteDate(value, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }, "Sem registro");
}

function hora(value: string) {
  return formatLiteDate(value, { hour: "2-digit", minute: "2-digit" });
}

function Situacao({ linha }: { linha: LinhaWhatsAppEquipe }) {
  const view = SITUACAO_VIEW[linha.situacao];
  return <span className={page.badge} data-tone={view.tone}>{view.label}</span>;
}

export function TeamWhatsAppLite({ rows, services = defaultServices }: { rows: LinhaWhatsAppEquipe[]; services?: TeamWhatsAppServices }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const notice = useActionNotice();
  const faixa = useMemo(() => faixaWhatsAppEquipe(rows), [rows]);
  const open = openId ? rows.find((row) => row.corretorId === openId) ?? null : null;

  const pedir = async (linha: LinhaWhatsAppEquipe) => {
    const result = await services.pedirReconexao(linha.corretorId);
    if (!result.success) throw new Error(result.error);
  };

  const pedirPeloMenu = async (linha: LinhaWhatsAppEquipe) => {
    notice.tap();
    try {
      await pedir(linha);
      notice.succeed(`Aviso enviado para ${linha.nome}.`);
    } catch (error) {
      notice.fail(error, { fallback: "Não deu para mandar o aviso agora.", retry: () => void pedirPeloMenu(linha) });
    }
  };

  const columns: LiteColumn<LinhaWhatsAppEquipe>[] = [
    { id: "nome", label: "Corretor", primary: true, render: (row) => <span className={page.cellTitle}>{row.nome}</span> },
    { id: "unidade", label: "Unidade", secondary: true, render: (row) => row.unidade ?? "Sem unidade" },
    { id: "situacao", label: "Situação", nowrap: true, render: (row) => <Situacao linha={row} /> },
    { id: "desde", label: "Desde", nowrap: true, numeric: true, render: (row) => quando(row.desde) },
    { id: "tentativas", label: "Tentativas hoje", nowrap: true, numeric: true, render: (row) => row.tentativas.length.toLocaleString("pt-BR") },
    {
      id: "acoes", label: "Ações", nowrap: true,
      render: (row) => (
        <LiteMenu
          label={`Ações de ${row.nome}`}
          items={[
            ...(semWhatsApp(row) ? [{ id: "pedir", label: "Pedir para reconectar", onSelect: () => void pedirPeloMenu(row) }] : []),
            { id: "perfil", label: "Abrir perfil", href: `/equipe/${row.corretorId}` },
          ]}
        />
      ),
    },
  ];

  const ultima = open?.tentativas.at(-1) ?? null;

  return (
    <>
      <section className={page.group} aria-labelledby="whatsapp-equipe-title">
        <header className={page.cardHead}>
          <h2 id="whatsapp-equipe-title" className={page.cardTitle}>WhatsApp da equipe</h2>
          <p className={page.cardDescription}>O WhatsApp de cada corretor ativo, com quem caiu primeiro. O vigia tenta religar sozinho quem já conectou antes.</p>
        </header>
        {faixa.mostrar ? <p role="status" className={styles.teamAlert}><span className={page.badge} data-tone="warning">{faixa.texto}</span></p> : null}
        <ActionNoticeLine notice={notice.notice} />
        <LiteResponsiveData
          caption="WhatsApp da equipe"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.corretorId}
          onRowOpen={(row) => setOpenId(row.corretorId)}
          rowTone={(row) => (row.situacao === "conectado" ? "muted" : undefined)}
          empty={<p className={page.emptyText}>Nenhum corretor ativo na equipe.</p>}
        />
      </section>

      <LiteSidePanel
        open={Boolean(open)}
        onOpenChange={(value) => { if (!value) setOpenId(null); }}
        title={open?.nome ?? "Corretor"}
        description={open ? `${SITUACAO_VIEW[open.situacao].label} · desde ${quando(open.desde)}` : undefined}
      >
        {open ? (
          <div className={styles.drawerBody}>
            <div className={styles.drawerBlock}>
              <h3 className={styles.drawerTitle}>Situação agora</h3>
              <p><Situacao linha={open} /></p>
              <p className={styles.drawerText}>{SITUACAO_VIEW[open.situacao].explicacao}</p>
              <p className={styles.drawerText}>Última mudança ou verificação: {quando(open.desde)}.</p>
            </div>
            <div className={styles.drawerBlock}>
              <h3 className={styles.drawerTitle}>Tentativas do vigia hoje</h3>
              {open.tentativas.length ? (
                <ol className={styles.drawerList}>
                  {open.tentativas.map((tentativa, index) => (
                    <li key={`${tentativa.em}-${index}`}>
                      <span className={page.numeric}>{hora(tentativa.em)}</span>
                      <span>{tentativa.resultado === "ok" ? "Pediu para religar" : "Tentou religar e falhou"}</span>
                    </li>
                  ))}
                </ol>
              ) : <p className={styles.drawerText}>Nenhuma tentativa hoje.</p>}
              {ultima ? <p className={styles.drawerText}>Última tentativa às {hora(ultima.em)}.</p> : null}
            </div>
            <div className={styles.drawerActions}>
              {semWhatsApp(open) ? (
                <LiteActionButton key={open.corretorId} tone="secondary" busyLabel="Enviando…" doneLabel="Aviso enviado" errorFallback="Não deu para mandar o aviso agora." onAction={() => pedir(open)}>
                  Pedir para reconectar
                </LiteActionButton>
              ) : null}
              <Link href={`/equipe/${open.corretorId}`} className={page.button}>Abrir perfil</Link>
            </div>
          </div>
        ) : null}
      </LiteSidePanel>
    </>
  );
}
