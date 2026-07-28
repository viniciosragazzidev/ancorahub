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
  if (!attachButton) return null;

  const host = document.createElement("span");
  host.id = "ancorahub-assistant-menu";
  host.setAttribute("aria-label", "AncoraHub Assistant");
  host.hidden = true;
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `<style>
    :host{--dropdown-open-dur:250ms;--dropdown-close-dur:150ms;--dropdown-pre-scale:.97;--dropdown-closing-scale:.99;--dropdown-ease:cubic-bezier(.22,1,.36,1);display:inline-flex;position:fixed;z-index:2147483646;font-family:Inter,ui-sans-serif,system-ui,sans-serif}:host([hidden]){display:none}.trigger{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:50%;background:transparent;color:#111b21;cursor:pointer}.trigger:hover,.trigger:focus-visible{background:#f0f2f5;color:#000;outline:0}.anchor{display:block;width:19px;height:19px}.t-dropdown{position:absolute;z-index:2;bottom:44px;left:-4px;width:264px;overflow:hidden;border:1px solid #e4e8eb;border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(11,20,26,.2);transform-origin:bottom left;transform:scale(var(--dropdown-pre-scale));opacity:0;pointer-events:none;transition:transform var(--dropdown-open-dur) var(--dropdown-ease),opacity var(--dropdown-open-dur) var(--dropdown-ease);will-change:transform,opacity}.t-dropdown.is-open{transform:scale(1);opacity:1;pointer-events:auto}.t-dropdown.is-closing{transform:scale(var(--dropdown-closing-scale));opacity:0;pointer-events:none;transition:transform var(--dropdown-close-dur) var(--dropdown-ease),opacity var(--dropdown-close-dur) var(--dropdown-ease)}.head{display:flex;align-items:center;gap:9px;padding:12px 12px 8px}.mark{display:grid;place-items:center;width:24px;height:24px;border-radius:7px;background:#e5f7ef;color:#176b5d;font-size:11px;font-weight:800}.identity{min-width:0;flex:1}.identity strong{display:block;overflow:hidden;color:#111b21;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.identity span{display:block;margin-top:2px;color:#667781;font-size:11px}.close{width:28px;height:28px;border:0;border-radius:7px;background:transparent;color:#667781;font-size:20px;cursor:pointer}.close:hover,.close:focus-visible{background:#f0f2f5;color:#111b21;outline:0}.body{padding:0 6px 8px}.next{margin:0;padding:7px 12px 9px;color:#667781;font-size:11px}.next strong{display:block;margin-top:3px;overflow:hidden;color:#25323a;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.actions{display:grid}.action,.suggestion{display:flex;align-items:center;gap:12px;min-height:44px;padding:0 12px;border:0;border-radius:8px;background:#fff;color:#25323a;font:inherit;font-size:13px;text-align:left;cursor:pointer}.action:hover,.action:focus-visible,.suggestion:hover,.suggestion:focus-visible{background:#f5f6f6;color:#111b21;outline:0}.action .item-icon{display:grid;place-items:center;width:20px;color:#176b5d;font-size:16px}.suggestions{display:grid;gap:2px;margin:4px 0}.suggestion{min-height:38px;padding:8px 12px 8px 44px;color:#42515a;font-size:12px;line-height:1.35}.hint{margin:7px 12px 3px;color:#667781;font-size:10px;line-height:1.35}.loading{margin:8px 12px;color:#667781;font-size:11px}.lead-sidebar{position:fixed;top:76px;right:16px;bottom:76px;z-index:1;width:min(344px,calc(100vw - 32px));overflow:auto;border:1px solid #e4e8eb;border-radius:14px;background:#fff;box-shadow:0 12px 32px rgba(11,20,26,.22);transform:translateX(calc(100% + 20px));opacity:0;pointer-events:none;transition:transform 400ms var(--dropdown-ease),opacity 400ms var(--dropdown-ease);will-change:transform,opacity}.lead-sidebar.is-open{transform:translateX(0);opacity:1;pointer-events:auto}.side-head{display:flex;align-items:center;gap:10px;padding:16px;border-bottom:1px solid #edf0f2}.side-title{min-width:0;flex:1}.side-title small{display:block;color:#667781;font-size:11px;font-weight:600}.side-title strong{display:block;overflow:hidden;margin-top:3px;color:#111b21;font-size:16px;text-overflow:ellipsis;white-space:nowrap}.side-close{display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:#667781;font-size:20px;cursor:pointer}.side-close:hover,.side-close:focus-visible{background:#f0f2f5;color:#111b21;outline:0}.side-body{padding:14px}.side-section{padding:13px 0;border-bottom:1px solid #edf0f2}.side-section:last-child{border-bottom:0}.side-label{margin:0 0 7px;color:#667781;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.side-value{margin:0;color:#25323a;font-size:13px;line-height:1.45}.side-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.side-grid div{padding:9px;border-radius:9px;background:#f7f8f8}.side-grid span{display:block;color:#667781;font-size:10px}.side-grid strong{display:block;overflow:hidden;margin-top:3px;color:#25323a;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.side-actions{display:grid;gap:4px}.side-actions .action{border:1px solid transparent}.side-actions .action:first-child{border-color:#d8e8e1;background:#f1faf6;color:#176b5d}.side-qualification{display:grid;gap:6px;margin:0;padding:0;list-style:none}.side-qualification li{display:flex;align-items:center;gap:8px;color:#42515a;font-size:12px}.side-qualification li::before{width:15px;color:#176b5d;content:'✓';font-weight:800}.side-qualification li.pending::before{color:#a8b2b7;content:'○'}@media (max-width:720px){.lead-sidebar{top:56px;right:8px;bottom:64px;width:min(340px,calc(100vw - 16px))}}@media (prefers-reduced-motion:reduce){.t-dropdown,.lead-sidebar{transition:none!important}}
  </style><button class="trigger" type="button" aria-label="Abrir AncoraHub Assistant" aria-expanded="false"><svg class="anchor" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M14.5 5.5C14.5 6.88071 13.3807 8 12 8C10.6193 8 9.5 6.88071 9.5 5.5C9.5 4.11929 10.6193 3 12 3C13.3807 3 14.5 4.11929 14.5 5.5Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M12 8V21" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M5 13L3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12L19 13" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/></svg></button><section class="t-dropdown" data-origin="bottom-left" aria-label="Ações do AncoraHub Assistant"><div id="content"></div></section><aside class="lead-sidebar" aria-label="Resumo do lead" aria-hidden="true"><div id="sidebar-content"></div></aside>`;

  const positionHost = () => {
    const rect = attachButton.getBoundingClientRect();
    host.style.left = `${Math.round(rect.right + 4)}px`;
    host.style.top = `${Math.round(rect.top + (rect.height - 36) / 2)}px`;
  };
  positionHost();
  document.body.appendChild(host);

  const trigger = shadow.querySelector<HTMLButtonElement>(".trigger")!;
  const dropdown = shadow.querySelector<HTMLElement>(".t-dropdown")!;
  const content = shadow.querySelector<HTMLElement>("#content")!;
  const sidebar = shadow.querySelector<HTMLElement>(".lead-sidebar")!;
  const sidebarContent = shadow.querySelector<HTMLElement>("#sidebar-content")!;
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
  const toggleSidebar = (force?: boolean) => {
    const shouldOpen = force ?? !sidebar.classList.contains("is-open");
    sidebar.classList.toggle("is-open", shouldOpen);
    sidebar.setAttribute("aria-hidden", String(!shouldOpen));
  };
  trigger.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); dropdown.classList.contains("is-open") ? close() : open(); });

  shadow.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = (event.target as Element).closest<HTMLElement>("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "close") return close();
    if (action === "toggle-sidebar") return toggleSidebar();
    if (action === "close-sidebar") return toggleSidebar(false);
    if (action === "open-lead" && target.dataset.leadId) return onOpenLead(target.dataset.leadId);
    if (action === "insert" && target.dataset.text) return void onInsertText(target.dataset.text).then(close);
    if (action === "quick-reply" && target.dataset.leadId && target.dataset.version) {
      const goal = target.dataset.goal as QuickReplyGoal;
      const originalMarkup = target.innerHTML;
      target.setAttribute("disabled", "true");
      target.textContent = "Preparando…";
      void onQuickReply(target.dataset.leadId, Number(target.dataset.version), goal)
        .then((suggestions) => {
          const list = suggestions.map((text) => `<button type="button" class="suggestion" data-action="insert" data-text="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join("");
          const existing = content.querySelector(".suggestions");
          if (existing) existing.innerHTML = list || "<p class=\"loading\">Não foi possível preparar uma sugestão agora.</p>";
        })
        .catch(() => { target.removeAttribute("disabled"); target.innerHTML = originalMarkup; });
    }
  });
  shadow.addEventListener("pointerdown", (event) => { event.stopPropagation(); });

  return {
    hide() { host.hidden = true; close(); toggleSidebar(false); },
    isMounted() {
      const mounted = document.contains(host) && document.contains(attachButton);
      if (!mounted) host.remove();
      return mounted;
    },
    renderLead(value) {
      const lead = value.lead as LeadSummary | undefined;
      if (!lead || typeof lead.id !== "string" || typeof lead.version !== "number") return;
      const status = escapeHtml(lead.currentStatus?.label ?? "Em atendimento");
      const unit = escapeHtml(lead.unit?.name ?? "Unidade autorizada");
      const nextAction = escapeHtml(lead.nextAction?.title ?? "Sem ação pendente");
      const missing = Array.isArray(lead.qualification?.missing) ? lead.qualification.missing.length : 0;
      const missingLabels = Array.isArray(lead.qualification?.missing) ? lead.qualification.missing.map((field) => escapeHtml(field)).slice(0, 4) : [];
      const completedLabels = Array.isArray(lead.qualification?.completed) ? lead.qualification.completed.map((field) => escapeHtml(field)).slice(0, 4) : [];
      const qualification = [...completedLabels.map((field) => `<li>${field}</li>`), ...missingLabels.map((field) => `<li class="pending">${field}</li>`)].join("") || "<li class=\"pending\">Sem campos configurados</li>";
      const quickActions = `<button class="action" type="button" data-action="quick-reply" data-goal="ASK_MISSING_FIELD" data-lead-id="${escapeHtml(lead.id)}" data-version="${lead.version}"><span class="item-icon" aria-hidden="true">?</span>Pedir dado${missing ? ` (${missing})` : ""}</button><button class="action" type="button" data-action="quick-reply" data-goal="CONTINUE_ATTENDANCE" data-lead-id="${escapeHtml(lead.id)}" data-version="${lead.version}"><span class="item-icon" aria-hidden="true">↳</span>Retomar conversa</button>`;
      positionHost();
      content.innerHTML = `<header class="head"><span class="mark" aria-hidden="true">A</span><div class="identity"><strong>${escapeHtml(lead.name ?? "Lead")}</strong><span>${status} · ${unit}</span></div><button class="close" type="button" data-action="close" aria-label="Fechar menu">×</button></header><div class="body"><p class="next">Próxima ação<strong>${nextAction}</strong></p><div class="actions" role="menu"><button class="action" role="menuitem" type="button" data-action="toggle-sidebar"><span class="item-icon" aria-hidden="true">☰</span>Ver resumo do lead</button><button class="action" role="menuitem" type="button" data-action="open-lead" data-lead-id="${escapeHtml(lead.id)}"><span class="item-icon" aria-hidden="true">↗</span>Abrir lead no CRM</button>${quickActions}</div><div class="suggestions"></div><p class="hint">As sugestões apenas preenchem a mensagem. Você revisa e envia.</p></div>`;
      sidebarContent.innerHTML = `<header class="side-head"><span class="mark" aria-hidden="true">A</span><div class="side-title"><small>Lead atual</small><strong>${escapeHtml(lead.name ?? "Lead")}</strong></div><button class="side-close" type="button" data-action="close-sidebar" aria-label="Fechar resumo">×</button></header><div class="side-body"><section class="side-section"><p class="side-label">Atendimento</p><div class="side-grid"><div><span>Status</span><strong>${status}</strong></div><div><span>Unidade</span><strong>${unit}</strong></div></div></section><section class="side-section"><p class="side-label">Próxima ação</p><p class="side-value">${nextAction}</p></section><section class="side-section"><p class="side-label">Qualificação</p><ul class="side-qualification">${qualification}</ul></section><section class="side-section"><p class="side-label">Ações rápidas</p><div class="side-actions">${quickActions}<button class="action" type="button" data-action="open-lead" data-lead-id="${escapeHtml(lead.id)}"><span class="item-icon" aria-hidden="true">↗</span>Abrir lead no CRM</button></div></section><p class="hint">Nenhuma mensagem é enviada automaticamente.</p></div>`;
      host.hidden = false;
    },
  };
}
