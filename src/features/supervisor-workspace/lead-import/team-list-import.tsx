"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Minus, Plus, UploadSimple } from "@phosphor-icons/react";

import { Button } from "@/components/arc/button/button";
import { LiteActionButton } from "@/components/lite/controls/action-button";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import { useDevLab } from "@/lib/dev-lab";

import { distributeTeamListAction, importTeamListAction, reviewTeamListAction } from "./actions";
import { SUPERVISOR_IMPORT_MAX, planShares, vcardToLines, type ReviewedContact, type TeamListApi } from "./parse-contacts";
import styles from "./team-list-import.module.css";

export type TeamListBroker = { id: string; name: string; availability: string };
export type TeamListPendingLead = { id: string; name: string };

const realApi: TeamListApi = {
  review: reviewTeamListAction,
  importContacts: importTeamListAction,
  distribute: distributeTeamListAction,
};

type Step = "lista" | "conferir" | "distribuir";

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/**
 * Lista interna da equipe (16/11/2026): colar ou enviar até 50 contatos, conferir e, depois, escolher quem recebe.
 * Nada vai para os corretores antes de tocar em Distribuir.
 */
export function TeamListImport({ pending, team }: { pending: TeamListPendingLead[]; team: TeamListBroker[] }) {
  const router = useRouter();
  const lab = useDevLab();
  const api = lab?.teamList ?? realApi;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(pending.length ? "distribuir" : "lista");
  const [text, setText] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [review, setReview] = useState<{ contacts: ReviewedContact[]; overflow: number } | null>(null);
  const [consent, setConsent] = useState(false);
  const [pendingLeads, setPendingLeads] = useState(pending);
  // O painel vai direto para o body: o cabeçalho da página prende elementos fixos e cortava o painel.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- só sabe que está no navegador depois de montar
  useEffect(() => setMounted(true), []);

  const ready = review?.contacts.filter((c) => c.phone && !c.problem && !c.duplicate) ?? [];
  const duplicates = review?.contacts.filter((c) => c.duplicate) ?? [];
  const problems = review?.contacts.filter((c) => c.problem) ?? [];

  function openSheet() {
    setStep(pendingLeads.length ? "distribuir" : "lista");
    setOpen(true);
  }

  /**
   * Excel (.xlsx/.xls), contatos do celular (.vcf), CSV ou texto: tudo vira texto aqui mesmo, uma linha por contato,
   * e aparece na caixa para a supervisora ver antes de conferir. O .vcf pode trazer fotos enormes: só nome,
   * telefone e e-mail seguem.
   */
  async function readFile(file: File) {
    setReviewError(null);
    setReview(null);
    try {
      const name = file.name.toLowerCase();
      if (/\.(xlsx|xls)$/.test(name)) {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, blankrows: false });
        setText(rows.map((row) => row.map((cell) => String(cell ?? "").trim()).filter(Boolean).join("\t")).filter(Boolean).join("\n"));
        return;
      }
      const content = await file.text();
      setText(/BEGIN:VCARD/i.test(content) ? vcardToLines(content) : content);
    } catch {
      setReviewError("Não consegui abrir esse arquivo. Tente salvar como CSV ou copiar e colar os contatos.");
    }
  }

  async function runReview() {
    setReviewing(true);
    setReviewError(null);
    const result = await api.review(text).catch(() => ({ ok: false as const, error: "Não consegui ler a lista agora. Tente de novo." }));
    setReviewing(false);
    if (!result.ok) {
      setReviewError(result.error);
      return;
    }
    setReview(result.data);
    setStep("conferir");
  }

  const title = step === "distribuir" ? "Distribuir para a equipe" : "Importar contatos";
  const description = step === "lista" ? `Cole ou envie até ${SUPERVISOR_IMPORT_MAX} contatos. Eles ficam só com a sua equipe.`
    : step === "conferir" ? "Confira antes de importar. Nada vai para os corretores agora."
      : "Escolha quem recebe. Só vai para os corretores quando você tocar em Distribuir.";

  return (
    <>
      <Button variant="secondary" size="sm" onClick={openSheet}>
        <UploadSimple size={16} aria-hidden="true" />
        {pendingLeads.length ? `Distribuir lista (${pendingLeads.length})` : "Importar contatos"}
      </Button>
      {mounted ? createPortal(<div className="arc-venancor"><LiteSidePanel open={open} onOpenChange={setOpen} title={title} description={description}>
        {step === "lista" ? (
          <div className={form.form}>
            <div className={form.field}>
              <label className={form.label} htmlFor="team-list-text">Um contato por linha</label>
              <textarea
                id="team-list-text"
                className={`${form.textarea} ${styles.list}`}
                value={text}
                onChange={(event) => { setText(event.target.value); setReview(null); }}
                placeholder={"Maria Silva (21) 99876-5432 maria@email.com\nJoão Souza 11912345678"}
              />
              <p className={form.hint}>Nome, celular e e-mail, em qualquer ordem. Também serve nome numa linha e telefone na de baixo.</p>
            </div>
            <label className={styles.file}>
              <UploadSimple size={16} aria-hidden="true" />
              Enviar arquivo (Excel, CSV ou contatos do celular)
              <input type="file" accept=".xlsx,.xls,.csv,.txt,.vcf,text/csv,text/plain,text/vcard,text/x-vcard" className={styles.srOnly} onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.target.value = ""; }} />
            </label>
            {reviewError ? <p role="alert" className={styles.error}>{reviewError}</p> : null}
            <div className={form.actions}>
              <Button onClick={runReview} disabled={!text.trim() || reviewing}>{reviewing ? "Lendo a lista…" : "Conferir"}</Button>
            </div>
          </div>
        ) : null}

        {step === "conferir" && review ? (
          <div className={form.form}>
            <dl className={form.summary}>
              <div><dt>Prontos</dt><dd>{ready.length}</dd></div>
              <div><dt>Ficam de fora</dt><dd>{duplicates.length + problems.length}</dd></div>
            </dl>
            {review.overflow ? <p className={form.hint}>{plural(review.overflow, "contato ficou", "contatos ficaram")} para a próxima importação (limite de {SUPERVISOR_IMPORT_MAX}).</p> : null}
            <ContactList title="Prontos para importar" items={ready.map((c) => ({ key: `${c.line}`, name: c.name, detail: [c.phoneLabel, c.email].filter(Boolean).join(" · ") }))} />
            <ContactList title="Ficam de fora" muted items={[...duplicates.map((c) => ({ key: `d${c.line}`, name: c.name || c.phoneLabel || `Linha ${c.line}`, detail: "Já está no sistema" })), ...problems.map((c) => ({ key: `p${c.line}`, name: c.name || c.phoneLabel || `Linha ${c.line}`, detail: c.problem ?? "" }))]} />
            <label className={styles.consent}>
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>Tenho autorização para contatar essas pessoas.</span>
            </label>
            <div className={form.actions}>
              <Button variant="ghost" onClick={() => setStep("lista")}>Voltar</Button>
              <LiteActionButton
                busyLabel="Importando…"
                doneLabel="Importado"
                disabled={!ready.length || !consent}
                keeps="A lista continua aqui para tentar de novo."
                onAction={async () => {
                  const result = await api.importContacts({ consent, contacts: ready.map((c) => ({ name: c.name, phone: c.phone!, email: c.email })) });
                  if (!result.ok) return { ok: false, message: result.error };
                  setPendingLeads((current) => [...current, ...result.data.leads]);
                  return { ok: true };
                }}
                onDone={() => {
                  router.refresh();
                  setStep("distribuir");
                }}
              >
                {`Importar ${plural(ready.length, "contato", "contatos")}`}
              </LiteActionButton>
            </div>
          </div>
        ) : null}

        {step === "distribuir" ? (
          <Distribute
            api={api}
            leads={pendingLeads}
            team={team}
            onDistributed={(left) => {
              setPendingLeads((current) => current.slice(current.length - left));
              router.refresh();
            }}
            onImportMore={() => { setText(""); setReview(null); setStep("lista"); }}
          />
        ) : null}
      </LiteSidePanel></div>, document.body) : null}
    </>
  );
}

function ContactList({ title, items, muted = false }: { title: string; items: Array<{ key: string; name: string; detail: string }>; muted?: boolean }) {
  if (!items.length) return null;
  return (
    <section className={form.field} aria-label={title}>
      <h3 className={form.label}>{title}</h3>
      <ul className={styles.rows}>
        {items.map((item) => (
          <li key={item.key} className={styles.row} data-muted={muted || undefined}>
            <span className={styles.name}>{item.name}</span>
            <span className={styles.detail}>{item.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Marcar os corretores e, se quiser, ajustar quantos cada um recebe. Começa dividindo igual entre os disponíveis. */
function Distribute({ api, leads, team, onDistributed, onImportMore }: {
  api: TeamListApi;
  leads: TeamListPendingLead[];
  team: TeamListBroker[];
  onDistributed: (left: number) => void;
  onImportMore: () => void;
}) {
  const [chosen, setChosen] = useState<string[]>(() => {
    const available = team.filter((broker) => broker.availability === "available").map((broker) => broker.id);
    return available.length ? available : team.map((broker) => broker.id);
  });
  const [manual, setManual] = useState<Record<string, number> | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const total = leads.length;

  const counts = useMemo(() => {
    if (manual) return manual;
    const { shares } = planShares(total, team.filter((broker) => chosen.includes(broker.id)).map((broker) => broker.id));
    return Object.fromEntries(shares.map((share) => [share.brokerId, share.count]));
  }, [manual, chosen, total, team]);
  const given = chosen.reduce((sum, id) => sum + (counts[id] ?? 0), 0);
  const left = total - given;

  function toggle(id: string) {
    setManual(null);
    setChosen((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  function change(id: string, delta: number) {
    const base = { ...counts };
    const next = Math.max(0, (base[id] ?? 0) + delta);
    if (delta > 0 && left <= 0) return;
    base[id] = next;
    setManual(base);
    if (!chosen.includes(id) && next > 0) setChosen((current) => [...current, id]);
  }

  if (!total) {
    return (
      <div className={form.form}>
        <p className={styles.done}>{result ?? "Nenhum lead esperando para distribuir."}</p>
        <div className={form.actions}>
          <Button variant="secondary" onClick={onImportMore}>Importar outra lista</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={form.form}>
      {result ? <p role="status" className={styles.done}>{result}</p> : null}
      <dl className={form.summary}>
        <div><dt>Para distribuir</dt><dd>{total}</dd></div>
        <div><dt>Ficam para depois</dt><dd>{left}</dd></div>
      </dl>
      {team.length ? (
        <ul className={form.checks} aria-label="Corretores da equipe">
          {team.map((broker) => {
            const on = chosen.includes(broker.id);
            const value = on ? counts[broker.id] ?? 0 : 0;
            return (
              <li key={broker.id} className={styles.broker}>
                <label className={form.check}>
                  <input type="checkbox" checked={on} onChange={() => toggle(broker.id)} />
                  <span className={styles.name}>{broker.name}</span>
                  {broker.availability !== "available" ? <span className={styles.detail}>Pausado</span> : null}
                </label>
                <span className={styles.stepper}>
                  <button type="button" aria-label={`Menos um para ${broker.name}`} disabled={!on || value === 0} onClick={() => change(broker.id, -1)}><Minus size={14} /></button>
                  <span aria-label={`${value} leads para ${broker.name}`}>{value}</span>
                  <button type="button" aria-label={`Mais um para ${broker.name}`} disabled={!on || left <= 0} onClick={() => change(broker.id, 1)}><Plus size={14} /></button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : <p className={form.hint}>Sua equipe ainda não tem corretores ativos.</p>}
      <div className={form.actions}>
        <LiteActionButton
          busyLabel="Distribuindo…"
          doneLabel="Distribuído"
          feedback="milestone"
          budgetKey="lista-equipe-distribuida"
          disabled={!given}
          keeps="Os leads continuam esperando aqui."
          onAction={async () => {
            const brokerIds = chosen.filter((id) => (counts[id] ?? 0) > 0);
            const response = await api.distribute({ leadIds: leads.map((lead) => lead.id), brokerIds, counts: Object.fromEntries(brokerIds.map((id) => [id, counts[id] ?? 0])) });
            if (!response.ok) return { ok: false, message: response.error };
            setResult(`${plural(response.data.distributed, "lead foi", "leads foram")} para a equipe. Cada corretor recebeu um aviso no CRM.`);
            onDistributed(response.data.left);
            setManual(null);
            return { ok: true };
          }}
        >
          {`Distribuir ${plural(given, "lead", "leads")}`}
        </LiteActionButton>
      </div>
    </div>
  );
}
