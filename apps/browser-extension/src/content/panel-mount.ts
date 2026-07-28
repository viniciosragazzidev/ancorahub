import type { ResolveState } from "../shared/types";

type LeadSummary = {
  id?: unknown;
  name?: unknown;
  currentStatus?: { label?: unknown };
  unit?: { name?: unknown } | null;
  nextAction?: { title?: unknown } | null;
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

export type MountedPanel = {
  hide(): void;
  renderLead(value: ResolveState): void;
};

export function mountPanel(onOpenLead: (leadId: string) => void): MountedPanel | null {
  const slot = document.querySelector('[data-testid="drawer-right"]');
  if (!slot) return null;

  const host = document.createElement("aside");
  host.id = "corretop-assistant-panel";
  host.setAttribute("aria-label", "CorreTop Assistant");
  host.hidden = true;
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `<style>
    :host{--ct-surface:#111b21;--ct-surface-raised:#202c33;--ct-border:#2a3942;--ct-text:#e9edef;--ct-muted:#8696a0;--ct-accent:#1fbf91;display:block;width:360px;height:100%;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:var(--ct-text);background:var(--ct-surface);border-left:1px solid var(--ct-border);box-sizing:border-box;transition:width var(--duration-fast,250ms) var(--ease-smooth-out,ease),opacity var(--duration-quick,150ms) var(--ease-smooth-out,ease)}
    :host([hidden]){display:none}:host([data-collapsed="true"]){width:52px}.panel{height:100%;display:flex;flex-direction:column;box-sizing:border-box;background:var(--ct-surface)}.top{display:flex;align-items:center;gap:10px;padding:18px 16px;border-bottom:1px solid var(--ct-border)}.mark{display:grid;place-items:center;width:28px;height:28px;flex:0 0 auto;border-radius:9px;background:#123d35;color:var(--ct-accent);font-weight:800}.title{min-width:0;flex:1}.title strong{display:block;font-size:13px;letter-spacing:.01em}.title span{display:block;margin-top:2px;color:var(--ct-muted);font-size:11px}.icon{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:8px;background:transparent;color:var(--ct-muted);cursor:pointer}.icon:hover,.icon:focus-visible{background:var(--ct-surface-raised);color:var(--ct-text);outline:0}.content{padding:18px 16px;overflow:auto}.eyebrow{margin:0 0 6px;color:var(--ct-accent);font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}.name{margin:0;font-size:19px;line-height:1.2;letter-spacing:-.02em}.meta{margin:7px 0 0;color:var(--ct-muted);font-size:12px;line-height:1.45}.card{margin-top:18px;padding:14px;border:1px solid var(--ct-border);border-radius:12px;background:var(--ct-surface-raised)}.card-label{color:var(--ct-muted);font-size:11px}.card-value{margin-top:4px;font-size:13px;font-weight:600;line-height:1.35}.action{width:100%;margin-top:18px;padding:10px 12px;border:1px solid #1b8a6a;border-radius:9px;background:#176b5d;color:white;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.action:hover,.action:focus-visible{background:#1b806d;outline:2px solid #57d6b1;outline-offset:2px}.collapsed-only{display:none}.expanded{min-width:0}@media (prefers-reduced-motion:reduce){:host{transition:none}.icon,.action{transition:none}}:host([data-collapsed="true"]) .expanded{display:none}:host([data-collapsed="true"]) .top{justify-content:center;padding:14px 8px}:host([data-collapsed="true"]) .collapsed-only{display:grid}.collapse-arrow{font-size:18px;line-height:1}
  </style><section class="panel"><header class="top"><span class="mark" aria-hidden="true">C</span><div class="title expanded"><strong>CorreTop Assistant</strong><span>Lead autorizado</span></div><button class="icon expanded" type="button" data-action="collapse" aria-label="Recolher painel"><span class="collapse-arrow">›</span></button><button class="icon collapsed-only" type="button" data-action="expand" aria-label="Expandir CorreTop Assistant"><span class="collapse-arrow">‹</span></button></header><div id="content" class="content expanded"></div></section>`;
  slot.appendChild(host);

  const content = shadow.getElementById("content");
  shadow.addEventListener("click", (event) => {
    const target = (event.target as Element).closest<HTMLElement>("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "collapse") host.dataset.collapsed = "true";
    if (action === "expand") delete host.dataset.collapsed;
    if (action === "open-lead" && target.dataset.leadId) onOpenLead(target.dataset.leadId);
  });

  return {
    hide() {
      host.hidden = true;
      if (content) content.innerHTML = "";
    },
    renderLead(value) {
      const lead = value.lead as LeadSummary | undefined;
      if (!lead || !content) return;
      const unit = lead.unit?.name ? `Unidade ${escapeHtml(lead.unit.name)}` : "Unidade autorizada";
      const status = escapeHtml(lead.currentStatus?.label ?? "Em atendimento");
      const nextAction = lead.nextAction?.title ? escapeHtml(lead.nextAction.title) : "Sem ação pendente";
      const leadId = typeof lead.id === "string" ? lead.id : "";
      content.innerHTML = `<p class="eyebrow">Conversa vinculada</p><h2 class="name">${escapeHtml(lead.name ?? "Lead")}</h2><p class="meta">${status} · ${unit}</p><section class="card"><div class="card-label">Próxima ação</div><div class="card-value">${nextAction}</div></section>${leadId ? `<button class="action" type="button" data-action="open-lead" data-lead-id="${escapeHtml(leadId)}">Abrir lead no CRM</button>` : ""}`;
      host.hidden = false;
    },
  };
}
