import type { ResolveState } from "../shared/types";

type LeadSummary = {
  id?: unknown;
  name?: unknown;
  currentStatus?: { label?: unknown };
  unit?: { name?: unknown } | null;
  nextAction?: { title?: unknown } | null;
  qualification?: { completed?: unknown; missing?: unknown };
  version?: unknown;
};

type QuickReplyGoal = "ASK_MISSING_FIELD" | "CONTINUE_ATTENDANCE";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

export type MountedPanel = {
  hide(): void;
  isMounted(): boolean;
  renderLead(value: ResolveState): void;
};

export function mountPanel(
  onOpenLead: (leadId: string) => void,
  onQuickReply: (leadId: string, version: number, goal: QuickReplyGoal) => Promise<string[]>,
  onInsertText: (text: string) => Promise<void>,
): MountedPanel | null {
  const attachButton = document.querySelector<HTMLButtonElement>('button[aria-label="Anexar"]');
  const attachSlot = attachButton?.closest("span");
  if (!attachSlot) return null;

  const host = document.createElement("span");
  host.id = "ancorahub-assistant-menu";
  host.setAttribute("aria-label", "AncoraHub Assistant");
  host.hidden = true;
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `<style>
    :host{--dropdown-open-dur:250ms;--dropdown-close-dur:150ms;--dropdown-pre-scale:.97;--dropdown-closing-scale:.99;--dropdown-ease:cubic-bezier(.22,1,.36,1);display:inline-block;position:relative;font-family:Inter,ui-sans-serif,system-ui,sans-serif}:host([hidden]){display:none}.trigger{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:50%;background:transparent;color:#54656f;cursor:pointer}.trigger:hover,.trigger:focus-visible{background:#f0f2f5;color:#176b5d;outline:0}.anchor{font-size:18px;font-weight:800;line-height:1}.t-dropdown{position:absolute;z-index:2;bottom:44px;left:-4px;width:264px;overflow:hidden;border:1px solid #e4e8eb;border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(11,20,26,.2);transform-origin:bottom left;transform:scale(var(--dropdown-pre-scale));opacity:0;pointer-events:none;transition:transform var(--dropdown-open-dur) var(--dropdown-ease),opacity var(--dropdown-open-dur) var(--dropdown-ease);will-change:transform,opacity}.t-dropdown.is-open{transform:scale(1);opacity:1;pointer-events:auto}.t-dropdown.is-closing{transform:scale(var(--dropdown-closing-scale));opacity:0;pointer-events:none;transition:transform var(--dropdown-close-dur) var(--dropdown-ease),opacity var(--dropdown-close-dur) var(--dropdown-ease)}.head{display:flex;align-items:center;gap:9px;padding:12px 12px 8px}.mark{display:grid;place-items:center;width:24px;height:24px;border-radius:7px;background:#e5f7ef;color:#176b5d;font-size:11px;font-weight:800}.identity{min-width:0;flex:1}.identity strong{display:block;overflow:hidden;color:#111b21;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.identity span{display:block;margin-top:2px;color:#667781;font-size:11px}.close{width:28px;height:28px;border:0;border-radius:7px;background:transparent;color:#667781;font-size:20px;cursor:pointer}.close:hover,.close:focus-visible{background:#f0f2f5;color:#111b21;outline:0}.body{padding:0 6px 8px}.next{margin:0;padding:7px 12px 9px;color:#667781;font-size:11px}.next strong{display:block;margin-top:3px;overflow:hidden;color:#25323a;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.actions{display:grid}.action,.suggestion{display:flex;align-items:center;gap:12px;min-height:44px;padding:0 12px;border:0;border-radius:8px;background:#fff;color:#25323a;font:inherit;font-size:13px;text-align:left;cursor:pointer}.action:hover,.action:focus-visible,.suggestion:hover,.suggestion:focus-visible{background:#f5f6f6;color:#111b21;outline:0}.action .item-icon{display:grid;place-items:center;width:20px;color:#176b5d;font-size:16px}.suggestions{display:grid;gap:2px;margin:4px 0}.suggestion{min-height:38px;padding:8px 12px 8px 44px;color:#42515a;font-size:12px;line-height:1.35}.hint{margin:7px 12px 3px;color:#667781;font-size:10px;line-height:1.35}.loading{margin:8px 12px;color:#667781;font-size:11px}@media (prefers-reduced-motion:reduce){.t-dropdown{transition:none!important}}
  </style><button class="trigger" type="button" aria-label="Abrir AncoraHub Assistant" aria-expanded="false"><span class="anchor" aria-hidden="true">⚓</span></button><section class="t-dropdown" data-origin="bottom-left" aria-label="Ações do AncoraHub Assistant"><div id="content"></div></section>`;
  attachSlot.after(host);

  const trigger = shadow.querySelector<HTMLButtonElement>(".trigger")!;
  const dropdown = shadow.querySelector<HTMLElement>(".t-dropdown")!;
  const content = shadow.querySelector<HTMLElement>("#content")!;
  let closeTimer: number | undefined;

  const open = () => {
    window.clearTimeout(closeTimer);
    dropdown.classList.remove("is-closing");
    dropdown.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
  };
  const close = () => {
    if (!dropdown.classList.contains("is-open")) return;
    dropdown.classList.remove("is-open");
    dropdown.classList.add("is-closing");
    trigger.setAttribute("aria-expanded", "false");
    closeTimer = window.setTimeout(() => dropdown.classList.remove("is-closing"), 150);
  };
  trigger.addEventListener("click", () => dropdown.classList.contains("is-open") ? close() : open());

  shadow.addEventListener("click", (event) => {
    const target = (event.target as Element).closest<HTMLElement>("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "close") return close();
    if (action === "open-lead" && target.dataset.leadId) return onOpenLead(target.dataset.leadId);
    if (action === "insert" && target.dataset.text) return void onInsertText(target.dataset.text).then(close);
    if (action === "quick-reply" && target.dataset.leadId && target.dataset.version) {
      const goal = target.dataset.goal as QuickReplyGoal;
      target.setAttribute("disabled", "true");
      target.textContent = "Preparando…";
      void onQuickReply(target.dataset.leadId, Number(target.dataset.version), goal)
        .then((suggestions) => {
          const list = suggestions.map((text) => `<button type="button" class="suggestion" data-action="insert" data-text="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join("");
          const existing = content.querySelector(".suggestions");
          if (existing) existing.innerHTML = list || "<p class=\"loading\">Não foi possível preparar uma sugestão agora.</p>";
        })
        .catch(() => { target.removeAttribute("disabled"); target.textContent = "Tentar novamente"; });
    }
  });

  return {
    hide() { host.hidden = true; close(); },
    isMounted() { return document.contains(host); },
    renderLead(value) {
      const lead = value.lead as LeadSummary | undefined;
      if (!lead || typeof lead.id !== "string" || typeof lead.version !== "number") return;
      const status = escapeHtml(lead.currentStatus?.label ?? "Em atendimento");
      const unit = escapeHtml(lead.unit?.name ?? "Unidade autorizada");
      const nextAction = escapeHtml(lead.nextAction?.title ?? "Sem ação pendente");
      const missing = Array.isArray(lead.qualification?.missing) ? lead.qualification?.missing.length : 0;
      content.innerHTML = `<header class="head"><span class="mark" aria-hidden="true">A</span><div class="identity"><strong>${escapeHtml(lead.name ?? "Lead")}</strong><span>${status} · ${unit}</span></div><button class="close" type="button" data-action="close" aria-label="Fechar menu">×</button></header><div class="body"><p class="next">Próxima ação<strong>${nextAction}</strong></p><div class="actions" role="menu"><button class="action" role="menuitem" type="button" data-action="open-lead" data-lead-id="${escapeHtml(lead.id)}"><span class="item-icon" aria-hidden="true">↗</span>Abrir lead no CRM</button><button class="action" role="menuitem" type="button" data-action="quick-reply" data-goal="ASK_MISSING_FIELD" data-lead-id="${escapeHtml(lead.id)}" data-version="${lead.version}"><span class="item-icon" aria-hidden="true">?</span>Pedir dado${missing ? ` (${missing})` : ""}</button><button class="action" role="menuitem" type="button" data-action="quick-reply" data-goal="CONTINUE_ATTENDANCE" data-lead-id="${escapeHtml(lead.id)}" data-version="${lead.version}"><span class="item-icon" aria-hidden="true">↳</span>Retomar conversa</button></div><div class="suggestions"></div><p class="hint">As sugestões apenas preenchem a mensagem. Você revisa e envia.</p></div>`;
      host.hidden = false;
    },
  };
}
