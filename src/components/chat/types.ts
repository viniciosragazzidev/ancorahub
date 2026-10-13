/**
 * Contract of the broker chat (docs/implementations/active/2026-10-09-corretor-chat.md).
 * Screens render ChatBlocks; scripts (pure functions over the broker's real
 * data) produce them. Choices are suggested replies: one tap runs an action
 * or opens the next question.
 */

export type AssistantId = "ancora" | "leads" | "plantao" | "agenda" | "cotacao" | "desempenho" | "insights" | "jornada"
  /** Supervisor Lite (2026-10-10): the team instead of the broker's own work. */
  | "equipe" | "equipe-leads" | "equipe-plantao" | "equipe-desempenho";

/** Mascot drawn by AssistantAvatar. "logo" is the company mark (verified Âncora thread). */
export type MascotShape = "mochi" | "onigiri" | "cubo" | "favo" | "nuvem" | "salte" | "logo" | "jack";

/** What a chosen reply does. Server actions are run by the screen through a registry, never by the script. */
export type ChatAction =
  | { kind: "href"; href: string }
  | { kind: "server"; name: ChatServerActionName; payload: Record<string, string | number | boolean | null> }
  /** Reveals a block of the script that stays hidden until this reply (a question or a button). */
  | { kind: "next"; questionId: string }
  /** Handled in the browser by the screen's onLocalChoice (guided flows like the quote). */
  | { kind: "local"; value: string };

/** Server actions a reply may trigger (each maps to an existing broker action). */
export type ChatServerActionName =
  | "lead.accept"
  | "lead.decline"
  | "lead.registerContact"
  | "lead.changeStep"
  | "lead.scheduleReturn"
  | "lead.completeReturn"
  | "lead.cancelReturn"
  | "lead.reopenReturn"
  | "lead.markLost"
  | "lead.addNote"
  | "duty.pause"
  | "duty.resume"
  | "notifications.markRead"
  | "relationship.ack"
  | "team.addBroker";

export type ChatChoice = {
  id: string;
  label: string;
  /** Small text under the label (e.g. "18:00"). */
  hint?: string;
  action: ChatAction;
  /** Text that appears as the broker's reply when chosen (defaults to the label). */
  reply?: string;
};

export type ChatFactRow = { label: string; value: string; badge?: string };
export type ChatListItem = {
  id: string; lead?: string; primary: string; secondary?: string; trailing?: string; href?: string;
  /** Swipe the row to the left (or its button, by keyboard) to run this action; the row leaves the list. */
  swipe?: { label: string; reply: string; action: Extract<ChatAction, { kind: "server" }> };
};

export type ChatBlock =
  | { type: "date"; id: string; label: string }
  | { type: "system"; id: string; text: string; strong?: string; action?: { label: string; choiceAction: ChatAction } }
  | { type: "assistant"; id: string; text: string; at?: string }
  /** A notification shown as in Notificações (Âncora conversation): icon by category, tag, link, unread dot. */
  | { type: "notice"; id: string; noticeType: string; leadId: string | null; title: string; message: string | null; at: string; atIso: string; unread: boolean }
  | { type: "user"; id: string; text: string; at?: string }
  /** A mirrored WhatsApp message: the client, the AI qualification or the broker, each with its own light bubble. */
  | { type: "whatsapp"; id: string; text: string; at?: string; from: "client" | "qualification" | "broker" }
  | { type: "facts"; id: string; title: string; subtitle?: string; rows: ChatFactRow[]; href?: string; hrefLabel?: string }
  | { type: "list"; id: string; title: string; subtitle?: string; items: ChatListItem[]; emptyText?: string }
  | { type: "bars"; id: string; title: string; subtitle?: string; values: Array<{ label: string; value: number; highlight?: boolean }>; format?: "count" | "currency" }
  | { type: "steps"; id: string; title: string; steps: Array<{ id: string; text: string; done: boolean }> }
  /** A live list of leads brought by "@" (one tap on a row opens the lead's quick card). */
  | { type: "leads"; id: string; title: string; icon: ChatBlockIcon; rows: ChatLeadRow[]; emptyText: string; updatedAt: string }
  /** The broker's numbers of the day ("@Meu dia"): tiles count up, the goal bar fills. */
  | { type: "stats"; id: string; title: string; icon: ChatBlockIcon; tiles: Array<{ label: string; value: number; tone?: ChatTone }>; goal?: { name: string; percentage: number; current: string; target: string } | null; updatedAt: string }
  /** The lead's quick card: what needs attention, the essentials, and one-tap actions. */
  | { type: "leadcard"; id: string; leadId: string; name: string; initials: string; stage: string; alert?: { tone: ChatTone; text: string } | null; rows: Array<{ label: string; value: string }>; whatsappHref?: string | null; href: string; fichaHref: string; updatedAt: string }
  /** LGPD: asked before the first use of AI; "question" is re-sent once the broker allows. */
  | { type: "consent"; id: string; question: string }
  /** Plantão to confirm now (online: one tap; presencial: photo of the place). */
  | { type: "presence"; id: string; ask: PresenceAskView }
  /** A whole assistant switched off for now: a calm hero with its mascot "resting". */
  | { type: "paused"; id: string; title: string; text: string; shape: MascotShape; hue: number }
  | { type: "question"; id: string; prompt: string; choices: ChatChoice[] }
  /** A real link as a button (WhatsApp): opened by the tap itself, so phones never block it. */
  | { type: "button"; id: string; text?: string; label: string; href: string; tone?: "whatsapp" | "action" };

/** A guided flow ("Combinando a função · 0 de 5"). */
export type ChatProgress = { title: string; done: number; total: number };

/** The plantão the broker must confirm now, as the client sees it (ISO dates). */
export type PresenceAskView = {
  assignmentId: string;
  scheduleName: string;
  branchName: string | null;
  mode: "online" | "presencial";
  startsAt: string;
  endsAt: string;
  status: "pending" | "awaiting_release" | "confirmed";
  photoId: string | null;
};

export type ChatTone = "info" | "success" | "warning" | "danger" | "neutral";
export type ChatBlockIcon = "leads" | "reply" | "agenda" | "day";
/** One lead in a live list block. */
export type ChatLeadRow = { leadId: string; name: string; initials: string; context: string; time?: string; chip?: { label: string; tone: ChatTone } };

export type ChatScript = {
  blocks: ChatBlock[];
  progress?: ChatProgress;
  /** Placeholder of the composer for this conversation. */
  composerPlaceholder?: string;
  /** Header status line ("Esperando você", "Trabalhando...", "Pausado"). */
  status?: { label: string; tone: "waiting" | "working" | "idle" | "paused" };
  /** After a server action, the first question comes back with the fresh data (Agenda: the next return). */
  replayAfterAction?: boolean;
};

/** One row of the conversation list (Início). */
export type ThreadSummary = {
  id: string;
  kind: "assistant" | "lead";
  assistant?: AssistantId;
  leadId?: string;
  name: string;
  verified?: boolean;
  /** Last line of the conversation. */
  preview: string;
  /** ISO time of the last event (null when nothing happened yet). */
  at: string | null;
  /** New since the broker last opened it: blue dot. */
  unread: boolean;
  /** The conversation is waiting for the broker: preview in blue, sorted first. */
  waitingYou: boolean;
  href: string;
  shape: MascotShape;
  /** 0-359 color of the mascot; null for the logo/lead initials. */
  hue: number | null;
  /** Lead threads: initials shown instead of a mascot. */
  initials?: string;
  /** Lead threads: hot/warm/cold ring. */
  temperature?: "hot" | "warm" | "cold" | null;
};
