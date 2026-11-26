"use client";

/**
 * Marketing > Links rastreáveis (26/11/2026), no visual Lite. Tabela com Nome, Destino, Cliques, Leads, Vendas e
 * Criado em; a linha abre a gaveta com o link para copiar, o QR code e os cliques por dia. No ⋯: Pausar (ou Ativar)
 * e Excluir. Um CTA só: "Novo link".
 *
 * Feedback (FEEDBACK.md, nível 1): criar, pausar e excluir confirmam só depois do servidor; a falha mostra a causa,
 * o que continua valendo e "Tentar de novo". Copiar é nível 0 (o botão diz "Copiado").
 */
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { LiteActionButton, LiteConfirmDialog, LiteMenu, LiteSelect } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { formatLiteDate } from "@/components/lite/format/date";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import { buildQrShape } from "@/features/call-ancora/components/call-ancora-motion";
import {
  createTrackingLinkAction,
  deleteTrackingLinkAction,
  setTrackingLinkStatusAction,
  trackingLinkDailyClicksAction,
} from "@/features/tracking-links/actions";
import { LINK_MESSAGE_MAX, LINK_NAME_MAX, type TrackingLinkDestination } from "@/features/tracking-links/core";
import type { TrackingLinkRow } from "@/features/tracking-links/service";

import { ActionNote, useActionStatus } from "@/app/(dashboard)/settings/_components/lite/action-status-lite";

type CompanyNumber = { phone: string; label: string };

const DESTINATION_LABEL: Record<TrackingLinkDestination, string> = { whatsapp: "WhatsApp da empresa", form: "Formulário público" };
const DEFAULT_MESSAGE = "Olá! Quero conhecer os planos de saúde.";
const count = (value: number) => value.toLocaleString("pt-BR");

export function shortLinkUrl(baseUrl: string, code: string) {
  return `${baseUrl.replace(/\/+$/, "")}/r/${code}`;
}

function formatPhone(digits: string) {
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return digits;
}

export function TrackingLinksLite({ initialLinks, numbers, baseUrl }: { initialLinks: TrackingLinkRow[]; numbers: CompanyNumber[]; baseUrl: string }) {
  const [links, setLinks] = useState(initialLinks);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { status, run } = useActionStatus();

  const openLink = openId ? links.find((link) => link.id === openId) ?? null : null;
  const deleting = confirmDelete ? links.find((link) => link.id === confirmDelete) ?? null : null;

  function toggle(link: TrackingLinkRow) {
    const next = link.status === "active" ? "paused" : "active";
    void run("list", async () => {
      const result = await setTrackingLinkStatusAction({ id: link.id, status: next });
      if (!result.success) throw new Error(result.error);
      setLinks((current) => current.map((item) => (item.id === link.id ? { ...item, status: next } : item)));
      return result;
    }, {
      done: next === "paused" ? `"${link.name}" pausado. Quem abrir o link vai para o formulário.` : `"${link.name}" ativo de novo.`,
      fallback: "Não consegui mudar o link.",
      keeps: next === "paused" ? "O link continua funcionando." : "O link continua pausado.",
    });
  }

  function remove(link: TrackingLinkRow) {
    setConfirmDelete(null);
    setOpenId(null);
    void run("list", async () => {
      const result = await deleteTrackingLinkAction(link.id);
      if (!result.success) throw new Error(result.error);
      setLinks((current) => current.filter((item) => item.id !== link.id));
      return result;
    }, { done: `"${link.name}" excluído.`, fallback: "Não consegui excluir o link.", keeps: "O link continua funcionando." });
  }

  const columns: LiteColumn<TrackingLinkRow>[] = [
    {
      id: "name",
      label: "Nome",
      primary: true,
      render: (link) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className={page.cellTitle}>{link.name}</span>
          {link.status === "paused" ? <span className={page.badge}>Pausado</span> : null}
        </span>
      ),
    },
    { id: "destination", label: "Destino", secondary: true, render: (link) => DESTINATION_LABEL[link.destination] },
    { id: "clicks", label: "Cliques", numeric: true, render: (link) => count(link.clicks) },
    { id: "leads", label: "Leads", numeric: true, render: (link) => count(link.leads) },
    { id: "sales", label: "Vendas", numeric: true, render: (link) => count(link.sales) },
    { id: "created", label: "Criado em", nowrap: true, render: (link) => formatLiteDate(link.createdAt, { day: "2-digit", month: "short", year: "numeric" }) },
    {
      id: "actions",
      label: "Ações",
      render: (link) => (
        <LiteMenu
          label={`Ações do link ${link.name}`}
          items={[
            { id: "toggle", label: link.status === "active" ? "Pausar" : "Ativar", onSelect: () => toggle(link) },
            { id: "delete", label: "Excluir", tone: "danger", onSelect: () => setConfirmDelete(link.id) },
          ]}
        />
      ),
    },
  ];

  return (
    <section className={page.card} aria-labelledby="links-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className={page.cardHead}>
          <h2 id="links-title" className={page.cardTitle}>Links rastreáveis</h2>
          <p className={page.cardDescription}>Cada link conta os cliques e marca a origem do lead que chega por ele.</p>
        </div>
        <button type="button" className={page.primaryButton} onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" size={16} />
          Novo link
        </button>
      </div>
      <ActionNote status={status.list} />
      <LiteResponsiveData
        caption="Links rastreáveis"
        columns={columns}
        rows={links}
        rowKey={(link) => link.id}
        onRowOpen={(link) => setOpenId(link.id)}
        rowTone={(link) => (link.status === "paused" ? "muted" : undefined)}
        empty={(
          <div className={page.empty}>
            <p className={page.emptyTitle}>Nenhum link ainda</p>
            <p className={page.emptyText}>Crie um link para a bio do Instagram ou para um panfleto e veja quantos leads ele traz.</p>
          </div>
        )}
      />

      <LiteSidePanel
        open={Boolean(openLink)}
        onOpenChange={(open) => { if (!open) setOpenId(null); }}
        title={openLink?.name ?? "Link"}
        description={openLink ? `${DESTINATION_LABEL[openLink.destination]}${openLink.status === "paused" ? ", pausado" : ""}` : undefined}
      >
        {openLink ? <LinkDetail key={openLink.id} link={openLink} baseUrl={baseUrl} /> : null}
      </LiteSidePanel>

      <LiteSidePanel open={creating} onOpenChange={setCreating} title="Novo link" description="O link curto conta os cliques e leva a pessoa ao destino.">
        {creating ? (
          <NewLinkForm
            numbers={numbers}
            onCreated={(link) => {
              setLinks((current) => [link, ...current.filter((item) => item.id !== link.id)]);
              setCreating(false);
              setOpenId(link.id);
            }}
          />
        ) : null}
      </LiteSidePanel>

      <LiteConfirmDialog
        open={Boolean(deleting)}
        title="Excluir link?"
        description={deleting ? `"${deleting.name}" para de funcionar e sai da lista. Os ${count(deleting.leads)} leads que vieram por ele continuam com a origem.` : undefined}
        confirmLabel="Excluir"
        tone="danger"
        onConfirm={() => { if (deleting) remove(deleting); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}

function LinkDetail({ link, baseUrl }: { link: TrackingLinkRow; baseUrl: string }) {
  const url = shortLinkUrl(baseUrl, link.code);
  const [copied, setCopied] = useState<"idle" | "done" | "error">("idle");
  const [daily, setDaily] = useState<{ state: "loading" } | { state: "ready"; rows: { day: string; clicks: number }[] } | { state: "error"; message: string }>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const qr = useMemo(() => buildQrShape(url), [url]);

  useEffect(() => {
    let alive = true;
    trackingLinkDailyClicksAction(link.id)
      .then((result) => {
        if (!alive) return;
        setDaily(result.success ? { state: "ready", rows: result.data } : { state: "error", message: result.error });
      })
      .catch(() => { if (alive) setDaily({ state: "error", message: "Não consegui carregar os cliques." }); });
    return () => { alive = false; };
  }, [link.id, attempt]);

  useEffect(() => {
    if (copied === "idle") return;
    const timer = window.setTimeout(() => setCopied("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("done");
    } catch {
      setCopied("error");
    }
  }

  return (
    <div className={form.form}>
      <div className={form.field}>
        <span className={form.label}>Link para divulgar</span>
        <div className="flex flex-wrap items-center gap-2">
          <input className={form.input} value={url} readOnly aria-label="Link para divulgar" onFocus={(event) => event.currentTarget.select()} style={{ flex: "1 1 200px" }} />
          <button type="button" className={page.button} onClick={() => void copy()} style={{ minWidth: 112 }}>
            {copied === "done" ? "Copiado" : "Copiar"}
          </button>
        </div>
        {copied === "error" ? <p role="alert" className={sections.error}>Não consegui copiar. Selecione o link e copie à mão.</p> : null}
        {link.status === "paused" ? <p className={sections.note}>Pausado: quem abrir vai para o formulário, sem contar clique nem origem.</p> : null}
      </div>

      <figure className="grid justify-items-center gap-2">
        <svg viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`} width={176} height={176} role="img" aria-label={`QR code do link ${link.name}`} className="rounded-(--radius-panel) bg-(--surface) text-(--foreground)" shapeRendering="crispEdges">
          <path d={qr.data} fill="currentColor" />
          {qr.finders.map(([row, col]) => (
            <g key={`${row}-${col}`} fill="currentColor">
              <path d={`M${col} ${row}h7v7h-7z M${col + 1} ${row + 1}v5h5v-5z`} fillRule="evenodd" />
              <path d={`M${col + 2} ${row + 2}h3v3h-3z`} />
            </g>
          ))}
        </svg>
        <figcaption className={sections.note}>Aponte a câmera para abrir o link.</figcaption>
      </figure>

      <div className="grid grid-cols-3 gap-2">
        <div className={page.stat}><span className={page.statLabel}>Cliques</span><span className={page.statValue}>{count(link.clicks)}</span></div>
        <div className={page.stat}><span className={page.statLabel}>Leads</span><span className={page.statValue}>{count(link.leads)}</span></div>
        <div className={page.stat}><span className={page.statLabel}>Vendas</span><span className={page.statValue}>{count(link.sales)}</span></div>
      </div>

      <div className={form.field}>
        <span className={form.label}>Cliques por dia, últimos 30 dias</span>
        {daily.state === "loading" ? <p className={sections.note}>Carregando…</p> : null}
        {daily.state === "error" ? (
          <div className="flex flex-wrap items-center gap-2">
            <p role="alert" className={sections.error}>{daily.message} Os números da tabela continuam valendo.</p>
            <button type="button" className={page.button} onClick={() => { setDaily({ state: "loading" }); setAttempt((value) => value + 1); }}>Tentar de novo</button>
          </div>
        ) : null}
        {daily.state === "ready" && daily.rows.length === 0 ? <p className={sections.note}>Nenhum clique nos últimos 30 dias.</p> : null}
        {daily.state === "ready" && daily.rows.length > 0 ? (
          <ul className={sections.list}>
            {daily.rows.map((row) => (
              <li key={row.day} className={sections.item}>
                <span className={sections.itemTitle}>{formatLiteDate(`${row.day}T12:00:00-03:00`, { weekday: "short", day: "2-digit", month: "short" })}</span>
                <span className="tabular-nums">{count(row.clicks)} {row.clicks === 1 ? "clique" : "cliques"}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <dl className="grid gap-1 text-sm">
        <div className="flex gap-2"><dt className={page.muted}>Origem</dt><dd>{link.utmSource}</dd></div>
        {link.utmMedium ? <div className="flex gap-2"><dt className={page.muted}>Mídia</dt><dd>{link.utmMedium}</dd></div> : null}
        {link.utmCampaign ? <div className="flex gap-2"><dt className={page.muted}>Campanha</dt><dd>{link.utmCampaign}</dd></div> : null}
        {link.destination === "whatsapp" && link.whatsappPhone ? <div className="flex gap-2"><dt className={page.muted}>WhatsApp</dt><dd className="tabular-nums">{formatPhone(link.whatsappPhone)}</dd></div> : null}
        {link.destination === "whatsapp" ? <div className="flex gap-2"><dt className={page.muted}>Mensagem</dt><dd>{link.whatsappMessage ?? "Sem texto"} (código {link.code})</dd></div> : null}
      </dl>
    </div>
  );
}

function NewLinkForm({ numbers, onCreated }: { numbers: CompanyNumber[]; onCreated: (link: TrackingLinkRow) => void }) {
  const [name, setName] = useState("");
  const [destination, setDestination] = useState<TrackingLinkDestination>(numbers.length ? "whatsapp" : "form");
  const [phone, setPhone] = useState(numbers[0]?.phone ?? "");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [source, setSource] = useState("");
  const [campaign, setCampaign] = useState("");
  const ready = name.trim() && source.trim() && (destination === "form" || phone.replace(/\D/g, "").length >= 10);

  return (
    <div className={form.form}>
      <label className={form.field}>
        <span className={form.label}>Nome</span>
        <input className={form.input} value={name} maxLength={LINK_NAME_MAX} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Instagram bio" />
      </label>
      <LiteSelect
        label="Destino"
        value={destination}
        onChange={(value) => setDestination(value === "form" ? "form" : "whatsapp")}
        options={[{ value: "whatsapp", label: DESTINATION_LABEL.whatsapp }, { value: "form", label: DESTINATION_LABEL.form }]}
      />
      {destination === "whatsapp" ? (
        <>
          {numbers.length ? (
            <LiteSelect
              label="Número"
              value={phone}
              onChange={setPhone}
              options={numbers.map((number) => ({ value: number.phone, label: `${number.label} ${formatPhone(number.phone)}` }))}
            />
          ) : (
            <label className={form.field}>
              <span className={form.label}>Número com DDD</span>
              <input className={form.input} value={phone} inputMode="tel" onChange={(event) => setPhone(event.target.value)} placeholder="(21) 99999-0000" />
            </label>
          )}
          <label className={form.field}>
            <span className={form.label}>Mensagem pronta</span>
            <textarea className={form.textarea} value={message} maxLength={LINK_MESSAGE_MAX} rows={3} onChange={(event) => setMessage(event.target.value)} />
            <span className={form.hint}>O código do link entra no fim da mensagem. É ele que marca a origem do lead.</span>
          </label>
        </>
      ) : (
        <p className={sections.note}>Leva ao formulário público, que já manda o lead para a distribuição.</p>
      )}
      <label className={form.field}>
        <span className={form.label}>Origem</span>
        <input className={form.input} value={source} onChange={(event) => setSource(event.target.value)} placeholder="Ex.: instagram, panfleto" />
      </label>
      <label className={form.field}>
        <span className={form.label}>Campanha (opcional)</span>
        <input className={form.input} value={campaign} onChange={(event) => setCampaign(event.target.value)} placeholder="Ex.: unimed-novembro" />
      </label>
      <div className={form.actions}>
        <LiteActionButton
          busyLabel="Criando…"
          doneLabel="Link criado"
          disabled={!ready}
          keeps="Nada foi criado. O que você preencheu continua aqui."
          errorFallback="Não consegui criar o link."
          onAction={async () => {
            const result = await createTrackingLinkAction({
              name,
              destination,
              whatsappPhone: destination === "whatsapp" ? phone : null,
              whatsappMessage: destination === "whatsapp" ? message : null,
              utmSource: source,
              utmCampaign: campaign || null,
            });
            if (!result.success) return { ok: false, message: result.error };
            onCreated(result.data);
            return { ok: true };
          }}
        >
          Criar link
        </LiteActionButton>
      </div>
    </div>
  );
}
