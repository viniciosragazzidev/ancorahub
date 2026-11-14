/**
 * Arco do aceite (Fase 6 do Motion e UX no Lite): ao aceitar o lead do "Seu próximo passo", um ponto viaja em
 * arco do botão até a contagem da aba Leads (onde está o RisePulse), mostrando para onde o lead foi.
 *
 * Regras de frequência (docs/ux/motion-frequencia.md): aceitar é raro por lead mas frequente no dia, então o
 * arco roda no máximo uma vez a cada 10 minutos (marca em memória da sessão, some ao recarregar). Nada acontece
 * com movimento reduzido, com o kill-switch html[data-interface-motion="off"], sem Web Animations API ou quando
 * a contagem não está visível na tela. É decoração: qualquer falha só faz o arco não aparecer.
 */

export const LEAD_ARC_COOLDOWN_MS = 10 * 60_000;
/** Até 400ms (pedido da fase); 360ms fica dentro do limite com folga. */
export const LEAD_ARC_DURATION_MS = 360;
export const LEAD_ARC_TARGET_ATTR = "data-lite-arc-target";
export const LEAD_ARC_TARGET = "leads";
const DOT_SIZE = 10;

type Point = { x: number; y: number };

let lastFlightAt: number | null = null;

/** Só para testes: zera a marca da sessão. */
export function resetLeadArcSession() {
  lastFlightAt = null;
}

export function canFlyLeadArc({ now, lastAt, motionEnabled }: { now: number; lastAt: number | null; motionEnabled: boolean }) {
  if (!motionEnabled) return false;
  return lastAt === null || now - lastAt >= LEAD_ARC_COOLDOWN_MS;
}

/**
 * Pontos de uma curva quadrática de `from` até `to`. O ponto de controle fica acima do mais alto dos dois, a uma
 * altura proporcional à distância (mínimo 40px), então o ponto sempre sobe antes de descer no alvo.
 */
export function leadArcPoints(from: Point, to: Point, steps = 12): Point[] {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = Math.max(40, distance * 0.35);
  const control = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
  const points: Point[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    points.push({ x: a * from.x + b * control.x + c * to.x, y: a * from.y + b * control.y + c * to.y });
  }
  return points;
}

function centerOf(rect: DOMRect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function isOnScreen(element: Element) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight || rect.left >= window.innerWidth) return false;
  const check = (element as Element & { checkVisibility?: (options?: object) => boolean }).checkVisibility;
  return typeof check === "function" ? check.call(element, { opacityProperty: true, visibilityProperty: true }) : true;
}

export function documentMotionEnabled() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (document.documentElement.dataset.interfaceMotion === "off") return false;
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Primeira contagem de Leads visível na tela, ou null. */
export function findLeadArcTarget(root: ParentNode = document) {
  const candidates = Array.from(root.querySelectorAll(`[${LEAD_ARC_TARGET_ATTR}="${LEAD_ARC_TARGET}"]`));
  return candidates.find(isOnScreen) ?? null;
}

/**
 * Faz o ponto voar de `origin` até a contagem de Leads. Devolve `true` se o arco começou. O ponto vive no
 * `body` (não no botão), então a navegação para a ficha do lead não o corta no meio.
 */
export function flyLeadArc(origin: Element, { motionEnabled = true, now = Date.now() }: { motionEnabled?: boolean; now?: number } = {}) {
  if (!canFlyLeadArc({ now, lastAt: lastFlightAt, motionEnabled: motionEnabled && documentMotionEnabled() })) return false;
  if (!isOnScreen(origin)) return false;
  const target = findLeadArcTarget();
  if (!target) return false;
  const dot = document.createElement("span");
  if (typeof dot.animate !== "function") return false;

  const from = centerOf(origin.getBoundingClientRect());
  const to = centerOf(target.getBoundingClientRect());
  const points = leadArcPoints(from, to);
  dot.setAttribute("aria-hidden", "true");
  dot.dataset.liteArcDot = "";
  Object.assign(dot.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: `${DOT_SIZE}px`,
    height: `${DOT_SIZE}px`,
    borderRadius: "999px",
    background: "var(--accent, #2563eb)",
    boxShadow: "var(--shadow-raised, 0 6px 18px rgb(0 0 0 / 0.08))",
    pointerEvents: "none",
    zIndex: "2147483000",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(dot);

  const last = points.length - 1;
  const keyframes = points.map((point, index) => ({
    transform: `translate(${point.x - DOT_SIZE / 2}px, ${point.y - DOT_SIZE / 2}px) scale(${index === last ? 0.6 : 1})`,
    opacity: index === last ? 0 : 1,
  }));
  try {
    const animation = dot.animate(keyframes, { duration: LEAD_ARC_DURATION_MS, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" });
    const remove = () => dot.remove();
    animation.onfinish = remove;
    animation.oncancel = remove;
  } catch {
    dot.remove();
    return false;
  }
  lastFlightAt = now;
  return true;
}
