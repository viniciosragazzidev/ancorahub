"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, UploadSimple } from "@phosphor-icons/react";

import { Button } from "@/components/arc/button/button";
import { LiteActionButton } from "@/components/lite/controls/action-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useDevLab } from "@/lib/dev-lab";

import { distributeTeamListAction, importTeamListAction, reviewTeamListAction } from "./actions";
import { SUPERVISOR_IMPORT_MAX, planShares, vcardToLines, type ReviewedContact, type TeamListApi } from "./parse-contacts";

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

  return (
    <>
      <Button variant="secondary" size="sm" onClick={openSheet}>
        <UploadSimple size={16} aria-hidden="true" />
        {pendingLeads.length ? `Distribuir lista (${pendingLeads.length})` : "Importar contatos"}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="arc-venancor">
          <SheetHeader>
            <SheetTitle>{step === "distribuir" ? "Distribuir para a equipe" : "Importar contatos"}</SheetTitle>
            <SheetDescription>
              {step === "lista" ? `Cole ou envie até ${SUPERVISOR_IMPORT_MAX} contatos. Eles ficam só com a sua equipe.`
                : step === "conferir" ? "Confira antes de importar. Nada vai para os corretores agora."
                  : "Escolha quem recebe. Só vai para os corretores quando você tocar em Distribuir."}
            </SheetDescription>
          </SheetHeader>

          {step === "lista" ? (
            <SheetBody className="flex flex-col gap-3 pt-4">
              <label className="text-sm font-medium text-(--foreground)" htmlFor="team-list-text">Um contato por linha: nome, celular e e-mail</label>
              <Textarea
                id="team-list-text"
                rows={10}
                value={text}
                onChange={(event) => { setText(event.target.value); setReview(null); }}
                placeholder={"Maria Silva (21) 99876-5432 maria@email.com\nJoão Souza 11912345678"}
              />
              <label className="w-max cursor-pointer text-sm font-medium text-(--chat-action-text)">
                Ou enviar arquivo (Excel, CSV ou contatos do celular)
                <input type="file" accept=".xlsx,.xls,.csv,.txt,.vcf,text/csv,text/plain,text/vcard,text/x-vcard" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} />
              </label>
              {reviewError ? <p role="alert" className="text-sm text-(--danger)">{reviewError}</p> : null}
            </SheetBody>
          ) : null}

          {step === "conferir" && review ? (
            <SheetBody className="flex flex-col gap-4 pt-4">
              <p className="text-sm text-(--text-secondary)">
                <span className="font-medium text-(--foreground)">{plural(ready.length, "pronto", "prontos")}</span>
                {duplicates.length ? ` · ${plural(duplicates.length, "já está no sistema", "já estão no sistema")}` : ""}
                {problems.length ? ` · ${plural(problems.length, "com problema", "com problema")}` : ""}
              </p>
              {review.overflow ? <p className="text-sm text-(--text-secondary)">{plural(review.overflow, "contato ficou", "contatos ficaram")} para a próxima importação (limite de {SUPERVISOR_IMPORT_MAX}).</p> : null}
              <ContactList title="Prontos para importar" items={ready.map((c) => ({ key: `${c.line}`, name: c.name, detail: [c.phoneLabel, c.email].filter(Boolean).join(" · ") }))} />
              <ContactList title="Não serão importados" muted items={[...duplicates.map((c) => ({ key: `d${c.line}`, name: c.name || c.phoneLabel || `Linha ${c.line}`, detail: "Já está no sistema" })), ...problems.map((c) => ({ key: `p${c.line}`, name: c.name || c.phoneLabel || `Linha ${c.line}`, detail: c.problem ?? "" }))]} />
              <label className="flex items-start gap-3 text-sm text-(--foreground)">
                <Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} aria-label="Tenho autorização para contatar essas pessoas" />
                <span>Tenho autorização para contatar essas pessoas.</span>
              </label>
            </SheetBody>
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

          {step === "lista" ? (
            <SheetFooter>
              <Button onClick={runReview} disabled={!text.trim() || reviewing}>{reviewing ? "Lendo a lista…" : "Conferir"}</Button>
            </SheetFooter>
          ) : null}

          {step === "conferir" ? (
            <SheetFooter className="flex flex-wrap gap-2">
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
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ContactList({ title, items, muted = false }: { title: string; items: Array<{ key: string; name: string; detail: string }>; muted?: boolean }) {
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h3 className="text-sm font-semibold text-(--foreground)">{title}</h3>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.key} className="flex flex-col rounded-xl border border-(--border) px-3 py-2">
            <span className={`text-sm font-medium ${muted ? "text-(--text-secondary)" : "text-(--foreground)"}`}>{item.name}</span>
            <span className="text-xs text-(--text-secondary)">{item.detail}</span>
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
      <SheetBody className="flex flex-col gap-3 pt-4">
        <p className="text-sm text-(--foreground)">{result ?? "Nenhum lead esperando para distribuir."}</p>
        <Button variant="secondary" className="w-max" onClick={onImportMore}>Importar outra lista</Button>
      </SheetBody>
    );
  }

  return (
    <>
      <SheetBody className="flex flex-col gap-3 pt-4">
        {result ? <p role="status" className="text-sm font-medium text-(--foreground)">{result}</p> : null}
        <p className="text-sm text-(--text-secondary)">
          <span className="font-medium text-(--foreground)">{plural(total, "lead", "leads")}</span> para distribuir
          {left > 0 ? ` · ${plural(left, "fica", "ficam")} para depois` : ""}
        </p>
        {team.length ? (
          <ul className="grid gap-2" aria-label="Corretores da equipe">
            {team.map((broker) => {
              const on = chosen.includes(broker.id);
              const value = on ? counts[broker.id] ?? 0 : 0;
              return (
                <li key={broker.id} className="flex items-center justify-between gap-3 rounded-xl border border-(--border) px-3 py-2">
                  <label className="flex min-w-0 items-center gap-3 text-sm text-(--foreground)">
                    <Checkbox checked={on} onCheckedChange={() => toggle(broker.id)} aria-label={`Incluir ${broker.name}`} />
                    <span className="truncate">{broker.name}</span>
                  </label>
                  <span className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" aria-label={`Menos um para ${broker.name}`} disabled={!on || value === 0} onClick={() => change(broker.id, -1)}><Minus size={14} /></Button>
                    <span className="w-8 text-center text-sm font-medium tabular-nums text-(--foreground)" aria-label={`${value} leads para ${broker.name}`}>{value}</span>
                    <Button variant="ghost" size="sm" aria-label={`Mais um para ${broker.name}`} disabled={!on || left <= 0} onClick={() => change(broker.id, 1)}><Plus size={14} /></Button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : <p className="text-sm text-(--text-secondary)">Sua equipe ainda não tem corretores ativos.</p>}
      </SheetBody>
      <SheetFooter>
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
      </SheetFooter>
    </>
  );
}
