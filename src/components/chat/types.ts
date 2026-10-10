/**
 * Contract of the broker chat (docs/implementations/active/2026-10-09-corretor-chat.md).
 * Screens render ChatBlocks; scripts (pure functions over the broker's real
 * data) produce them. Choices are suggested replies: one tap runs an action
 * or opens the next question.
 */

export type AssistantId = "ancora" | "leads" | "plantao" | "agenda" | "cotacao" | "desempenho" | "insights";

/** Mascot drawn by AssistantAvatar. "logo" is the company mark (verified Âncora thread). */
export type MascotShape = "mochi" | "onigiri" | "cubo" | "favo" | "nuvem" | "salte" | "logo";

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
  | "lead.markLost"
  | "lead.addNote"
  | "duty.pause"
  | "duty.resume"
  | "notifications.markRead"
  | "relationship.ack";

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
export type ChatListItem = { id: string; lead?: string; primary: string; secondary?: string; trailing?: string; href?: string };

export type ChatBlock =
  | { type: "date"; id: string; label: string }
  | { type: "system"; id: string; text: string; strong?: string; action?: { label: string; choiceAction: ChatAction } }
  | { type: "assistant"; id: string; text: string; at?: string }
  | { type: "user"; id: string; text: string; at?: string }
  /** A mirrored WhatsApp message: the client, the AI qualification or the broker, each with its own light bubble. */
  | { type: "whatsapp"; id: string; text: string; at?: string; from: "client" | "qualification" | "broker" }
  | { type: "facts"; id: string; title: string; subtitle?: string; rows: ChatFactRow[]; href?: string; hrefLabel?: string }
  | { type: "list"; id: string; title: string; subtitle?: string; items: ChatListItem[]; emptyText?: string }
  | { type: "bars"; id: string; title: string; subtitle?: string; values: Array<{ label: string; value: number; highlight?: boolean }>; format?: "count" | "currency" }
  | { type: "steps"; id: string; title: string; steps: Array<{ id: string; text: string; done: boolean }> }
  | { type: "question"; id: string; prompt: string; choices: ChatChoice[] }
  /** A real link as a button (WhatsApp): opened by the tap itself, so phones never block it. */
  | { type: "button"; id: string; text?: string; label: string; href: string; tone?: "whatsapp" | "action" };

/** A guided flow ("Combinando a função · 0 de 5"). */
export type ChatProgress = { title: string; done: number; total: number };

export type ChatScript = {
  blocks: ChatBlock[];
  progress?: ChatProgress;
  /** Placeholder of the composer for this conversation. */
  composerPlaceholder?: string;
  /** Header status line ("Esperando você", "Trabalhando...", "Pausado"). */
  status?: { label: string; tone: "waiting" | "working" | "idle" | "paused" };
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
