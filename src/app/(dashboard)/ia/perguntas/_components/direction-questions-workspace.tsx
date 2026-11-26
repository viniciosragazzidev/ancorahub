"use client";

/**
 * Perguntas para a direção (/ia/perguntas): tabela Lite com abas Abertas e Respondidas; a linha abre a gaveta com o
 * trecho da conversa e o campo da resposta. "Enviar ao lead" usa o canal da conversa; "Ensinar a IA" guarda a resposta
 * na base de conhecimento. Sucesso só depois do servidor (FEEDBACK.md, nível 1).
 */
import { useMemo, useState } from "react";
import Link from "next/link";

import { LiteActionButton, LiteMenu } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { formatLiteDate } from "@/components/lite/format/date";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { answerDirectionQuestionAction } from "@/features/ai-qualification/direction-questions-actions";
import {
  DIRECTION_ANSWER_MAX,
  EXCERPT_SPEAKER,
  describeDirectionOutcome,
  directionChannelLabel,
  directionQuestionsForTab,
  directionStatusView,
  type DirectionQuestionRow,
  type DirectionQuestionTab,
} from "@/features/ai-qualification/direction-questions-core";

import hub from "../../_components/ia-hub.module.css";

export type DirectionQuestionsServices = {
  answer: (input: { id: string; answer: string; sendToLead: boolean; teach: boolean }) => Promise<{ ok: true; row: DirectionQuestionRow | null } | { ok: false; error: string }>;
};

const defaultServices: DirectionQuestionsServices = { answer: answerDirectionQuestionAction };

function when(value: string | null) {
  return formatLiteDate(value, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }, "Sem data");
}

function leadLabel(row: DirectionQuestionRow) {
  return row.leadName?.trim() || "Lead sem nome";
}

/** `canTeach`: só o diretor ensina a IA (26/11); o gestor da unidade responde e envia ao lead. */
export function DirectionQuestionsWorkspace({ initialRows, canTeach = true, services = defaultServices }: { initialRows: DirectionQuestionRow[]; canTeach?: boolean; services?: DirectionQuestionsServices }) {
  const [rows, setRows] = useState(initialRows);
  const [tab, setTab] = useState<DirectionQuestionTab>("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [sendToLead, setSendToLead] = useState(true);
  const [teach, setTeach] = useState(canTeach);
  // Respondida pela gaveta: o botão fica mostrando o resultado até a gaveta fechar.
  const [answeredHere, setAnsweredHere] = useState<string | null>(null);

  const openCount = rows.filter((row) => row.status === "open").length;
  const visible = useMemo(() => directionQuestionsForTab(rows, tab), [rows, tab]);
  const open = openId ? rows.find((row) => row.id === openId) ?? null : null;

  const openRow = (row: DirectionQuestionRow) => {
    setOpenId(row.id);
    setAnswer("");
    setSendToLead(Boolean(row.leadId));
    setTeach(canTeach);
    setAnsweredHere(null);
  };

  const submit = async (row: DirectionQuestionRow) => {
    const result = await services.answer({ id: row.id, answer, sendToLead: sendToLead && Boolean(row.leadId), teach: canTeach && teach });
    if (!result.ok) return { ok: false as const, message: result.error };
    const updated: DirectionQuestionRow = result.row ?? {
      ...row,
      status: "answered",
      answer: answer.trim(),
      answeredAt: new Date().toISOString(),
      sentToLeadAt: sendToLead ? new Date().toISOString() : null,
      taught: canTeach && teach,
    };
    setRows((current) => current.map((item) => (item.id === row.id ? updated : item)));
    setAnsweredHere(row.id);
    return { ok: true as const };
  };

  const columns: LiteColumn<DirectionQuestionRow>[] = [
    { id: "when", label: "Quando", nowrap: true, numeric: true, render: (row) => when(row.createdAt) },
    { id: "lead", label: "Lead", nowrap: true, render: (row) => leadLabel(row) },
    {
      id: "question", label: "Pergunta", primary: true,
      render: (row) => <span className={`${page.cellTitle} ${page.clamp2}`}>{row.question}</span>,
    },
    {
      id: "status", label: "Situação", nowrap: true,
      render: (row) => { const view = directionStatusView(row.status); return <span className={page.badge} data-tone={view.tone}>{view.label}</span>; },
    },
    {
      id: "actions", label: "Ações", nowrap: true,
      render: (row) => (
        <span onClick={(event) => event.stopPropagation()}>
          <LiteMenu
            label={`Ações da pergunta de ${leadLabel(row)}`}
            items={[
              { id: "open", label: row.status === "open" ? "Responder" : "Ver resposta", onSelect: () => openRow(row) },
              ...(row.leadId ? [{ id: "lead", label: "Abrir lead", href: `/leads/${row.leadId}` }] : []),
            ]}
          />
        </span>
      ),
    },
  ];

  const answering = open && (open.status === "open" || answeredHere === open.id);

  return (
    <>
      <section className={page.group} aria-labelledby="ia-direction-title">
        <header className={page.cardHead}>
          <h2 id="ia-direction-title" className={page.cardTitle}>Perguntas para a direção</h2>
          <p className={page.cardDescription}>Quando a IA não sabe algo, ela diz ao lead que vai confirmar com a equipe e a pergunta chega aqui.</p>
        </header>
        <nav className={page.countTabs} aria-label="Filtrar perguntas">
          {([
            { value: "open", label: "Abertas", count: openCount },
            { value: "answered", label: "Respondidas", count: rows.length - openCount },
          ] as const).map((item) => (
            <button key={item.value} type="button" className={page.countTab} data-active={tab === item.value ? "true" : undefined} aria-pressed={tab === item.value} onClick={() => setTab(item.value)}>
              {item.label}<span className={page.countPill}>{item.count}</span>
            </button>
          ))}
        </nav>
        <LiteResponsiveData
          caption="Perguntas para a direção"
          columns={columns}
          rows={visible}
          rowKey={(row) => row.id}
          onRowOpen={openRow}
          rowTone={(row) => (row.status === "open" ? undefined : "muted")}
          empty={<p className={page.emptyText}>{tab === "open" ? "Nenhuma pergunta aberta. A IA está sabendo responder." : "Nenhuma pergunta respondida ainda."}</p>}
        />
      </section>

      <LiteSidePanel
        open={Boolean(open)}
        onOpenChange={(value) => { if (!value) { setOpenId(null); setAnsweredHere(null); } }}
        title={open ? `Pergunta de ${leadLabel(open)}` : "Pergunta"}
        description={open ? `${directionStatusView(open.status).label} · ${when(open.createdAt)}` : undefined}
      >
        {open ? (
          <div className={hub.drawerBody}>
            <div className={hub.drawerBlock}>
              <h3 className={hub.drawerTitle}>Pergunta</h3>
              <p className={hub.drawerText}>{open.question}</p>
            </div>
            <div className={hub.drawerBlock}>
              <h3 className={hub.drawerTitle}>Trecho da conversa</h3>
              {open.excerpt.length ? (
                <dl className={hub.facts}>
                  {open.excerpt.map((line, index) => (
                    <div key={`${line.at ?? "sem-data"}-${index}`}>
                      <dt>{EXCERPT_SPEAKER[line.from]}{line.at ? ` · ${when(line.at)}` : ""}</dt>
                      <dd>{line.text}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className={hub.drawerText}>Sem mensagens guardadas desta conversa.</p>
              )}
            </div>
            {open.status === "answered" && answeredHere !== open.id ? (
              <div className={hub.drawerBlock}>
                <h3 className={hub.drawerTitle}>Resposta</h3>
                <p className={hub.drawerText}>{open.answer}</p>
                <p className={hub.drawerText}>
                  {describeDirectionOutcome(open)} {open.answeredByName ? `Por ${open.answeredByName}` : ""}{open.answeredAt ? ` em ${when(open.answeredAt)}.` : ""}
                </p>
              </div>
            ) : null}
            {answering ? (
              <div className={form.form}>
                <label className={form.field}>
                  <span className={form.label}>Sua resposta</span>
                  <textarea
                    className={form.textarea}
                    value={answeredHere === open.id ? open.answer ?? answer : answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    maxLength={DIRECTION_ANSWER_MAX}
                    readOnly={answeredHere === open.id}
                    placeholder="Ex.: Sim, a Amil cobre o hospital no plano S450."
                  />
                </label>
                <div className={form.field}>
                  <label className={form.check}>
                    <input type="checkbox" checked={sendToLead && Boolean(open.leadId)} disabled={!open.leadId || answeredHere === open.id} onChange={(event) => setSendToLead(event.target.checked)} />
                    <span>Enviar ao lead pelo {directionChannelLabel(open.transport)}</span>
                  </label>
                  {canTeach ? (
                    <label className={form.check}>
                      <input type="checkbox" checked={teach} disabled={answeredHere === open.id} onChange={(event) => setTeach(event.target.checked)} />
                      <span>Ensinar a IA para as próximas vezes</span>
                    </label>
                  ) : null}
                </div>
                <div className={hub.drawerActions}>
                  <LiteActionButton
                    busyLabel={sendToLead ? "Enviando…" : "Salvando…"}
                    doneLabel={answeredHere === open.id ? describeDirectionOutcome(open) : "Respondida"}
                    keeps="A pergunta continua aberta."
                    errorFallback="Não deu para responder agora."
                    disabled={answer.trim().length < 2 && answeredHere !== open.id}
                    onAction={() => submit(open)}
                  >
                    Responder
                  </LiteActionButton>
                  {open.leadId ? <Link href={`/leads/${open.leadId}`} className={page.button}>Abrir lead</Link> : null}
                </div>
              </div>
            ) : open.leadId ? (
              <div className={hub.drawerActions}>
                <Link href={`/leads/${open.leadId}`} className={page.button}>Abrir lead</Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </LiteSidePanel>
    </>
  );
}
