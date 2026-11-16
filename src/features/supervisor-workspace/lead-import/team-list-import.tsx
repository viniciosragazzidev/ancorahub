"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FileXls, Minus, Plus, UploadSimple, X } from "@phosphor-icons/react";

import { Button } from "@/components/arc/button/button";
import { LiteActionButton } from "@/components/lite/controls/action-button";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import { useDevLab } from "@/lib/dev-lab";

import { distributeTeamListAction, importTeamListAction, reviewTeamListAction, structureTeamListAction } from "./actions";
import { applyTableAnswer, applyTextAnswer, organizeTable, organizeText, tableRequest, textRequest, textToTable, type Organized, type SourceTable } from "./organize";
import { SUPERVISOR_IMPORT_CHUNK, SUPERVISOR_IMPORT_MAX, planShares, vcardToLines, type ParsedContact, type TeamListApi } from "./parse-contacts";
import styles from "./team-list-import.module.css";

export type TeamListBroker = { id: string; name: string; availability: string };

const realApi: TeamListApi = {
  structure: structureTeamListAction,
  review: reviewTeamListAction,
  importContacts: importTeamListAction,
  distribute: distributeTeamListAction,
};

type Step = "lista" | "conferir" | "distribuir";
type Review = { organized: Organized; known: Set<string>; weekLeft: number; cut: number };

const fmt = (n: number) => n.toLocaleString("pt-BR");
const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${fmt(n)} ${many}`);
const isReady = (contact: ParsedContact) => Boolean(contact.phone && !contact.problem);

/** "A · CLIENTE", "B · CONTATO" → "A, B e C". */
function joinColumns(labels: string[]) {
  const short = labels.map((label) => label.split(" · ")[1] ?? label);
  return short.length <= 1 ? short.join("") : `${short.slice(0, -1).join(", ")} e ${short.at(-1)}`;
}

/**
 * Lista interna da equipe. 16/11/2026: a lista entra inteira (até 5.000 por semana), lida por colunas e, na dúvida,
 * com ajuda da IA. Uma busca de repetidos no banco, gravação em blocos de 1.000. Nada vai para os corretores antes
 * de tocar em Distribuir.
 */
export function TeamListImport({ pending, team }: { pending: number; team: TeamListBroker[] }) {
  const router = useRouter();
  const lab = useDevLab();
  const api = lab?.teamList ?? realApi;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(pending ? "distribuir" : "lista");
  const [text, setText] = useState("");
  const [file, setFile] = useState<{ name: string; tables: SourceTable[] } | null>(null);
  const [sheet, setSheet] = useState(0);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [consent, setConsent] = useState(false);
  const [pendingCount, setPendingCount] = useState(pending);
  const [progress, setProgress] = useState("Importando…");
  const [notice, setNotice] = useState<string | null>(null);
  // Blocos já gravados desta lista: "Tentar de novo" continua de onde parou.
  const sent = useRef<{ importId: string; upTo: number; imported: number; duplicates: number } | null>(null);
  // O painel vai direto para o body: o cabeçalho da página prende elementos fixos e cortava o painel.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- só sabe que está no navegador depois de montar
  useEffect(() => setMounted(true), []);

  const view = useMemo(() => {
    if (!review) return null;
    const contacts = review.organized.contacts;
    const ready = contacts.filter((contact) => isReady(contact) && !review.known.has(contact.phone!));
    const room = Math.min(review.weekLeft, SUPERVISOR_IMPORT_MAX);
    const toImport = ready.slice(0, room);
    const inCrm = contacts.filter((contact) => isReady(contact) && review.known.has(contact.phone!));
    const groups = new Map<string, number[]>();
    for (const contact of contacts) {
      if (!contact.problem) continue;
      groups.set(contact.problem, [...(groups.get(contact.problem) ?? []), contact.line]);
    }
    if (inCrm.length) groups.set("Já está no CRM.", inCrm.map((contact) => contact.line));
    const outside = [...groups].sort((a, b) => b[1].length - a[1].length);
    return { toImport, later: ready.length - toImport.length, outside, outsideTotal: outside.reduce((sum, [, lines]) => sum + lines.length, 0), fixed: toImport.filter((contact) => contact.fixed).length };
  }, [review]);

  function openSheet() {
    setStep(pendingCount ? "distribuir" : "lista");
    setOpen(true);
  }

  function resetList() {
    setText("");
    setFile(null);
    setSheet(0);
    setReview(null);
    setReviewError(null);
    setConsent(false);
    sent.current = null;
  }

  /** Excel (todas as abas), CSV, texto ou contatos do celular (.vcf). Planilha fica em colunas, sem virar texto. */
  async function readFile(picked: File) {
    resetList();
    try {
      const name = picked.name.toLowerCase();
      if (/\.(xlsx|xls)$/.test(name)) {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(await picked.arrayBuffer(), { type: "array" });
        const tables = workbook.SheetNames.map((sheetName) => {
          const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: false, blankrows: false, defval: "" });
          return { name: sheetName, rows: raw.map((row) => Array.from(row, (value) => String(value ?? "").trim())) };
        }).filter((table) => table.rows.length);
        if (!tables.length) throw new Error("vazio");
        // Começa pela aba com mais linhas; a supervisora troca se quiser.
        const biggest = tables.reduce((best, table, index) => (table.rows.length > tables[best].rows.length ? index : best), 0);
        setFile({ name: picked.name, tables });
        setSheet(biggest);
        return;
      }
      const content = await picked.text();
      const plain = /BEGIN:VCARD/i.test(content) ? vcardToLines(content) : content;
      const table = textToTable(plain);
      if (table) setFile({ name: picked.name, tables: [{ name: picked.name, rows: table }] });
      else setText(plain);
    } catch {
      setReviewError("Não consegui abrir esse arquivo. Tente salvar como Excel ou CSV, ou copiar e colar os contatos.");
    }
  }

  async function runReview() {
    setReviewError(null);
    setReviewing("Lendo a lista…");
    const rows = file?.tables[sheet]?.rows ?? null;
    let organized = rows ? organizeTable(rows) : organizeText(text);
    if (!organized.confident) {
      // Camada 2: a IA só vê o formato (números e e-mails mascarados) e devolve o mapa, que é conferido aqui.
      const request = rows ? tableRequest(rows) : textRequest(text);
      if (request) {
        setReviewing("Organizando com ajuda da IA…");
        const answer = await api.structure(request).catch(() => null);
        if (answer?.ok && answer.data) {
          const applied = rows ? applyTableAnswer(rows, answer.data) : applyTextAnswer(text, answer.data);
          if (applied?.contacts.length) organized = applied;
        }
      }
    }
    if (!organized.contacts.length) {
      setReviewing(null);
      setReviewError("Não achei contatos nessa lista. Confira se tem uma coluna de nome e outra de celular.");
      return;
    }
    const cut = Math.max(0, organized.contacts.length - SUPERVISOR_IMPORT_MAX);
    organized = { ...organized, contacts: organized.contacts.slice(0, SUPERVISOR_IMPORT_MAX) };
    setReviewing("Procurando quem já está no CRM…");
    const phones = [...new Set(organized.contacts.filter(isReady).map((contact) => contact.phone!))];
    const result = await api.review(phones).catch(() => ({ ok: false as const, error: "Não consegui conferir a lista agora. Tente de novo." }));
    setReviewing(null);
    if (!result.ok) {
      setReviewError(result.error);
      return;
    }
    sent.current = null;
    setReview({ organized, known: new Set(result.data.known), weekLeft: result.data.weekLeft, cut });
    setStep("conferir");
  }

  async function importAll() {
    if (!view) return { ok: false as const, message: "Confira a lista de novo." };
    const state = sent.current ?? { importId: crypto.randomUUID(), upTo: 0, imported: 0, duplicates: 0 };
    sent.current = state;
    const total = view.toImport.length;
    while (state.upTo < total) {
      setProgress(`Importando… ${fmt(state.upTo)} de ${fmt(total)}`);
      const chunk = view.toImport.slice(state.upTo, state.upTo + SUPERVISOR_IMPORT_CHUNK);
      const result = await api.importContacts({
        consent,
        importId: state.importId,
        contacts: chunk.map((contact) => ({ name: contact.name, phone: contact.phone!, email: contact.email, note: contact.note })),
      }).catch(() => ({ ok: false as const, error: "A conexão caiu no meio da importação." }));
      if (!result.ok) {
        const done = state.imported ? ` ${plural(state.imported, "contato já entrou", "contatos já entraram")}; o resto continua aqui.` : "";
        return { ok: false as const, message: `${result.error}${done}` };
      }
      state.upTo += chunk.length;
      state.imported += result.data.imported;
      state.duplicates += result.data.duplicates;
    }
    setPendingCount((current) => current + state.imported);
    setNotice(`${plural(state.imported, "contato importado", "contatos importados")}.${state.duplicates ? ` ${plural(state.duplicates, "já estava", "já estavam")} no CRM.` : ""} Agora escolha quem recebe.`);
    return { ok: true as const };
  }

  const title = step === "distribuir" ? "Distribuir para a equipe" : "Importar contatos";
  const description = step === "lista" ? "Cole a lista ou envie a planilha. Os contatos ficam só com a sua equipe."
    : step === "conferir" ? "Confira antes de importar. Nada vai para os corretores agora."
      : "Escolha quem recebe. Só vai para os corretores quando você tocar em Distribuir.";
  const table = file?.tables[sheet];

  return (
    <>
      <Button variant="secondary" size="sm" onClick={openSheet}>
        <UploadSimple size={16} aria-hidden="true" />
        {pendingCount ? `Distribuir lista (${fmt(pendingCount)})` : "Importar contatos"}
      </Button>
      {mounted ? createPortal(<div className="arc-venancor"><LiteSidePanel open={open} onOpenChange={setOpen} title={title} description={description}>
        {step === "lista" ? (
          <div className={form.form}>
            {file && table ? (
              <>
                <ul className={styles.rows}>
                  <li className={`${styles.row} ${styles.fileRow}`}>
                    <FileXls size={20} aria-hidden="true" />
                    <span className={styles.fileText}>
                      <span className={styles.name}>{file.name}</span>
                      <span className={styles.detail}>{plural(table.rows.length, "linha", "linhas")}{file.tables.length > 1 ? ` na aba ${table.name}` : ""}</span>
                    </span>
                    <button type="button" className={styles.iconButton} aria-label="Tirar o arquivo" onClick={resetList}><X size={16} /></button>
                  </li>
                </ul>
                {file.tables.length > 1 ? (
                  <div className={form.field}>
                    <label className={form.label} htmlFor="team-list-sheet">Aba da planilha</label>
                    <select id="team-list-sheet" className={form.input} value={sheet} onChange={(event) => { setSheet(Number(event.target.value)); setReview(null); }}>
                      {file.tables.map((item, index) => <option key={item.name} value={index}>{`${item.name} (${plural(item.rows.length, "linha", "linhas")})`}</option>)}
                    </select>
                  </div>
                ) : null}
              </>
            ) : (
              <div className={form.field}>
                <label className={form.label} htmlFor="team-list-text">Lista de contatos</label>
                <textarea
                  id="team-list-text"
                  className={`${form.textarea} ${styles.list}`}
                  value={text}
                  onChange={(event) => { setText(event.target.value); setReview(null); }}
                  placeholder={"Maria Silva (21) 99876-5432 maria@email.com\nJoão Souza 11912345678"}
                />
                <p className={form.hint}>Em qualquer formato: colado do Excel, do WhatsApp ou um por linha. O sistema separa nome, celular e e-mail.</p>
              </div>
            )}
            {!file ? (
              <label className={styles.file}>
                <UploadSimple size={16} aria-hidden="true" />
                Enviar arquivo (Excel, CSV ou contatos do celular)
                <input type="file" accept=".xlsx,.xls,.csv,.txt,.vcf,text/csv,text/plain,text/vcard,text/x-vcard" className={styles.srOnly} onChange={(event) => { const picked = event.target.files?.[0]; if (picked) void readFile(picked); event.target.value = ""; }} />
              </label>
            ) : null}
            {reviewError ? <p role="alert" className={styles.error}>{reviewError}</p> : null}
            <div className={form.actions}>
              <Button onClick={runReview} disabled={(!file && !text.trim()) || Boolean(reviewing)}>{reviewing ?? "Conferir"}</Button>
            </div>
          </div>
        ) : null}

        {step === "conferir" && review && view ? (
          <div className={form.form}>
            <dl className={form.summary}>
              <div><dt>Vão entrar</dt><dd>{fmt(view.toImport.length)}</dd></div>
              <div><dt>Ficam de fora</dt><dd>{fmt(view.outsideTotal)}</dd></div>
            </dl>
            <ReadAs organized={review.organized} />
            {view.later || review.cut ? (
              <p className={form.hint}>
                {view.later ? `${plural(view.later, "contato fica", "contatos ficam")} para depois: o limite é de ${fmt(review.weekLeft)} até a semana virar. ` : ""}
                {review.cut ? `A lista passou de ${fmt(SUPERVISOR_IMPORT_MAX)} contatos: ${plural(review.cut, "ficou", "ficaram")} fora desta vez.` : ""}
              </p>
            ) : null}
            <ContactList
              title="Vão entrar"
              items={[
                ...view.toImport.slice(0, 5).map((contact) => ({ key: `r${contact.line}`, name: contact.name, detail: [contact.phoneLabel, contact.email, contact.fixed].filter(Boolean).join(" · ") })),
                ...(view.toImport.length > 5 ? [{ key: "more", name: `e mais ${fmt(view.toImport.length - 5)}`, detail: view.fixed ? `${plural(view.fixed, "celular ganhou", "celulares ganharam")} o 9 que faltava.` : "" }] : []),
              ]}
            />
            <ContactList
              title="Ficam de fora"
              muted
              items={view.outside.map(([reason, lines]) => ({
                key: reason,
                name: `${fmt(lines.length)} · ${reason.replace(/\.$/, "")}`,
                detail: `${lines.length === 1 ? "Linha" : "Linhas"} ${lines.slice(0, 6).join(", ")}${lines.length > 6 ? "…" : ""}`,
              }))}
            />
            <label className={styles.consent}>
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>Tenho autorização para contatar essas pessoas.</span>
            </label>
            <div className={form.actions}>
              <Button variant="ghost" onClick={() => setStep("lista")}>Voltar</Button>
              <LiteActionButton
                busyLabel={progress}
                doneLabel="Importado"
                disabled={!view.toImport.length || !consent}
                keeps="A lista continua aqui."
                onAction={importAll}
                onDone={() => {
                  router.refresh();
                  resetList();
                  setStep("distribuir");
                }}
              >
                {`Importar ${plural(view.toImport.length, "contato", "contatos")}`}
              </LiteActionButton>
            </div>
          </div>
        ) : null}

        {step === "distribuir" ? (
          <Distribute
            api={api}
            total={pendingCount}
            team={team}
            notice={notice}
            onDistributed={(left) => {
              setPendingCount(left);
              setNotice(null);
              router.refresh();
            }}
            onImportMore={() => { resetList(); setNotice(null); setStep("lista"); }}
          />
        ) : null}
      </LiteSidePanel></div>, document.body) : null}
    </>
  );
}

/** Como a lista foi lida, em uma frase: a supervisora vê se o sistema entendeu a planilha. */
function ReadAs({ organized }: { organized: Organized }) {
  const map = organized.map;
  const ai = organized.aiUsed ? " Organizado com ajuda da IA." : "";
  if (!map) return <p className={form.hint}>{`Lido linha a linha: nome, celular e e-mail separados em cada contato.${ai}`}</p>;
  const label = (index: number) => organized.columns[index] ?? "";
  const extras = map.extras.map(label);
  return (
    <p className={form.hint}>
      {`Coluna ${label(map.name)} é o nome e ${label(map.phone)} é o celular`}
      {map.email !== null ? `; ${label(map.email)} é o e-mail` : ""}
      {extras.length ? `. ${extras.length === 1 ? "A coluna" : "As colunas"} ${joinColumns(extras)} ${extras.length === 1 ? "vai" : "vão"} para a anotação do lead.` : "."}
      {ai}
    </p>
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
            {item.detail ? <span className={styles.detail}>{item.detail}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Marcar os corretores e, se quiser, ajustar quantos cada um recebe. Começa dividindo igual entre os disponíveis. */
function Distribute({ api, total, team, notice, onDistributed, onImportMore }: {
  api: TeamListApi;
  total: number;
  team: TeamListBroker[];
  notice: string | null;
  onDistributed: (left: number) => void;
  onImportMore: () => void;
}) {
  const [chosen, setChosen] = useState<string[]>(() => {
    const available = team.filter((broker) => broker.availability === "available").map((broker) => broker.id);
    return available.length ? available : team.map((broker) => broker.id);
  });
  const [manual, setManual] = useState<Record<string, number> | null>(null);
  const [result, setResult] = useState<string | null>(null);

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

  /** Quantidade digitada ou no − e +: nunca passa do que sobra. */
  function set(id: string, wanted: number) {
    const base = Object.fromEntries(chosen.map((brokerId) => [brokerId, counts[brokerId] ?? 0]));
    const others = given - (base[id] ?? 0);
    base[id] = Math.max(0, Math.min(Math.floor(wanted) || 0, total - others));
    setManual(base);
    if (!chosen.includes(id) && base[id] > 0) setChosen((current) => [...current, id]);
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
      {result || notice ? <p role="status" className={styles.done}>{result ?? notice}</p> : null}
      <dl className={form.summary}>
        <div><dt>Para distribuir</dt><dd>{fmt(total)}</dd></div>
        <div><dt>Ficam para depois</dt><dd>{fmt(left)}</dd></div>
      </dl>
      {team.length ? (
        <>
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
                    <button type="button" aria-label={`Menos um para ${broker.name}`} disabled={!on || value === 0} onClick={() => set(broker.id, value - 1)}><Minus size={14} /></button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={total}
                      value={value}
                      disabled={!on}
                      aria-label={`Leads para ${broker.name}`}
                      onChange={(event) => set(broker.id, Number(event.target.value))}
                    />
                    <button type="button" aria-label={`Mais um para ${broker.name}`} disabled={!on || left <= 0} onClick={() => set(broker.id, value + 1)}><Plus size={14} /></button>
                  </span>
                </li>
              );
            })}
          </ul>
          {manual ? <Button variant="ghost" size="sm" onClick={() => setManual(null)}>Dividir igual de novo</Button> : null}
        </>
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
            const picked = Object.fromEntries(chosen.filter((id) => (counts[id] ?? 0) > 0).map((id) => [id, counts[id] ?? 0]));
            const response = await api.distribute({ counts: picked });
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
