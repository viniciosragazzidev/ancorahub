"use client";

/**
 * Atendimento, Mensagens, no visual Lite. Mesma lista, filtros, contagens e ações da tela atual: sincronizar templates
 * da Meta, mensagem de cada situação (o mesmo painel de políticas, com o mesmo canManage de hoje), nova mensagem (texto
 * livre ou template da Meta) e o mesmo painel de detalhe da mensagem.
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";

import { LiteFilterChips, LiteMenu } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import compat from "@/components/lite/page/lite-compat.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import { toast } from "@/components/ui/sonner";
import type { MessageKind } from "@/features/message-library/catalog";
import type { LibraryMessage } from "@/features/message-library/service";

import { TemplateBuilderWizard } from "../../../integrations/whatsapp/_components/template-builder-wizard";
import { MessagePoliciesPanel } from "../../../qualificacao/_components/message-policies-panel";
import { MessageDrawer, type DrawerTarget } from "./message-drawer";

type KindFilter = "all" | MessageKind;

function channelLabels(message: LibraryMessage) {
  const short: Record<string, string> = {
    "meta:always": "Meta",
    "meta:window": message.kind === "quick_reply" ? "Meta · na conversa" : "Meta · 24h",
    "company_number:always": "WhatsApp da empresa",
    "company_number:window": "WhatsApp da empresa · na conversa",
  };
  return message.validity.filter((item) => item.valid !== "never").map((item) => short[`${item.channel}:${item.valid}`] ?? item.label);
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function MessagesWorkspaceLite({ messages, dutyReminderEnabled = false }: { messages: LibraryMessage[]; dutyReminderEnabled?: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<DrawerTarget>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [preferred, setPreferred] = useState<{ templateId: string; eventKey: string } | null>(null);
  const [syncing, startSync] = useTransition();

  const counts = useMemo(() => ({
    all: messages.length,
    meta_template: messages.filter((message) => message.kind === "meta_template").length,
    free_message: messages.filter((message) => message.kind === "free_message").length,
    quick_reply: messages.filter((message) => message.kind === "quick_reply").length,
  }), [messages]);
  const needle = normalize(query.trim());
  const rows = (filter === "all" ? messages : messages.filter((message) => message.kind === filter)).filter((message) => !needle || normalize(message.name).includes(needle));
  const pages = useLitePages(rows, 15);
  const inUse = messages.filter((message) => message.usages.length).length;

  const refresh = () => router.refresh();
  const current = target?.mode === "view" ? messages.find((message) => message.id === target.message.id) : null;
  const drawerTarget: DrawerTarget = target?.mode === "view" ? (current ? { mode: "view", message: current } : null) : target;

  const sync = () => startSync(async () => {
    const response = await fetch("/api/integrations/whatsapp/templates/sync", { method: "POST" }).catch(() => null);
    if (!response?.ok) { toast.error("Não foi possível sincronizar com a Meta agora."); return; }
    toast.success("Templates sincronizados com a Meta.");
    refresh();
  });

  const columns: LiteColumn<LibraryMessage>[] = [
    { id: "name", label: "Mensagem", primary: true, render: (message) => <span><span className={page.cellTitle}>{message.name}</span><span className={page.cellSub}>{message.text || "Sem texto sincronizado"}</span></span> },
    { id: "kind", label: "Tipo", nowrap: true, render: (message) => <span className={page.badge} data-tone={message.kind === "meta_template" ? "info" : undefined}>{message.kindLabel}</span> },
    { id: "channel", label: "Canal", secondary: true, render: (message) => channelLabels(message).join(" · ") },
    { id: "usages", label: "Em uso", render: (message) => (message.usages.length ? (message.usages.length === 1 ? message.usages[0]!.label : `${message.usages.length} lugares`) : <span className={page.muted}>Não usada</span>) },
    { id: "status", label: "Status", nowrap: true, render: (message) => <span className={page.muted}>{message.status}</span> },
  ];

  return (
    <>
      <section className={page.group} aria-labelledby="messages-title">
        <header className={page.cardHead}>
          <h2 id="messages-title" className={page.cardTitle}>Mensagens ({messages.length} · {inUse} em uso)</h2>
          <p className={page.cardDescription}>Tudo o que o sistema envia para clientes e para a equipe. Abra uma mensagem para ver onde ela vale, onde é usada e por qual canal sai.</p>
        </header>
        <div className={page.toolbar}>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input className={page.searchInput} value={query} onChange={(event) => { setQuery(event.target.value); pages.reset(); }} placeholder="Buscar mensagem" aria-label="Buscar mensagem" />
          </label>
          <span className={page.toolbarEnd} style={{ display: "flex", gap: 8 }}>
            <LiteMenu
              label="Configurações das mensagens"
              items={[
                { id: "policies", label: "Mensagem de cada situação", onSelect: () => setPoliciesOpen(true) },
                { id: "sync", label: syncing ? "Sincronizando templates…" : "Sincronizar templates da Meta", onSelect: sync },
              ]}
            />
            <button type="button" className={page.primaryButton} onClick={() => setChooserOpen(true)}>
              <Plus aria-hidden="true" size={16} />
              Nova mensagem
            </button>
          </span>
        </div>
        <LiteFilterChips
          scroll
          label="Filtrar por tipo"
          active={[filter]}
          onToggle={(id) => { setFilter(id as KindFilter); pages.reset(); }}
          chips={[
            { id: "all", label: "Todas", count: counts.all },
            { id: "meta_template", label: "Templates Meta", count: counts.meta_template },
            { id: "free_message", label: "Textos livres", count: counts.free_message },
            { id: "quick_reply", label: "Respostas da IA", count: counts.quick_reply },
          ]}
        />
        <LiteResponsiveData caption="Mensagens do atendimento" columns={columns} rows={pages.pageRows} rowKey={(message) => message.id} onRowOpen={(message) => setTarget({ mode: "view", message })} empty={<p className={page.emptyText}>Nenhuma mensagem encontrada.</p>} />
        <LitePagination {...pages.pagination} label="Páginas das mensagens" />
      </section>

      <MessageDrawer
        target={drawerTarget}
        dutyReminderEnabled={dutyReminderEnabled}
        onClose={() => setTarget(null)}
        onChanged={refresh}
        onUseInSituation={(templateId, eventKey) => {
          setTarget(null);
          setPreferred({ templateId, eventKey });
          setPoliciesOpen(true);
        }}
      />

      <LiteSidePanel open={chooserOpen} onOpenChange={setChooserOpen} title="Nova mensagem" description="Escolha o tipo de mensagem.">
        <ul className={sections.list} style={{ border: "1px solid var(--border)", borderRadius: "calc(var(--radius-surface) - 8px)", overflow: "hidden" }}>
          <li>
            <button type="button" className={sections.itemButton} onClick={() => { setChooserOpen(false); setTarget({ mode: "new_free" }); }}>
              <span className={sections.itemText}>
                <span className={sections.rowTitle}>Texto livre</span>
                <span className={sections.rowDescription}>WhatsApp da empresa a qualquer hora; Meta só na janela de 24h</span>
              </span>
            </button>
          </li>
          <li>
            <button type="button" className={sections.itemButton} onClick={() => { setChooserOpen(false); setWizardOpen(true); }}>
              <span className={sections.itemText}>
                <span className={sections.rowTitle}>Template da Meta</span>
                <span className={sections.rowDescription}>Vai para aprovação da Meta; depois sai a qualquer hora</span>
              </span>
            </button>
          </li>
        </ul>
      </LiteSidePanel>

      <LiteSidePanel open={policiesOpen} onOpenChange={setPoliciesOpen} title="Mensagem de cada situação" description="Qual template ou texto sai em cada momento do atendimento, com a contingência. Vale depois de salvar e publicar.">
        <div className={compat.compat}>
          <MessagePoliciesPanel
            canManage
            preferredMetaTemplateId={preferred?.templateId ?? null}
            preferredEventKey={preferred?.eventKey ?? null}
            onPreferredMetaTemplateApplied={() => setPreferred(null)}
          />
        </div>
      </LiteSidePanel>

      {wizardOpen ? <TemplateBuilderWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onSuccess={() => { setWizardOpen(false); refresh(); }} /> : null}
    </>
  );
}
