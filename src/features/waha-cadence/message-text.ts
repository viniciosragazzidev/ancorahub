/**
 * The text of a native WAHA message, wherever the engine put it.
 *
 * WAHA fills `body` for plain chats, but some shapes leave it empty and only
 * carry the text in the raw engine message (`_data`): WEBJS keeps it in
 * `_data.body`/`_data.caption`; NOWEB and GOWS keep the WhatsApp proto in
 * `_data.message` / `_data.Message`, where the text may be wrapped in a
 * disappearing (`ephemeralMessage`), view-once, edited or document-with-caption
 * envelope, or be a reply (`extendedTextMessage`) or a button/list answer.
 * Reading only `body` stored those messages as "[text]" and lost the text.
 */

type Rec = Record<string, unknown>;

const asRecord = (value: unknown): Rec | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : null;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Proto envelopes whose `.message` holds the real message (camelCase and PascalCase engines). */
const WRAPPERS = [
  "ephemeralMessage",
  "viewOnceMessage",
  "viewOnceMessageV2",
  "viewOnceMessageV2Extension",
  "documentWithCaptionMessage",
  "editedMessage",
  "deviceSentMessage",
  "groupMentionedMessage",
  "botInvokeMessage",
];

/** `fooBar` and `FooBar` both appear depending on the engine's JSON casing. */
function field(record: Rec, name: string): unknown {
  if (name in record) return record[name];
  const pascal = name.charAt(0).toUpperCase() + name.slice(1);
  return record[pascal];
}

function protoText(message: Rec | null, depth = 0): string {
  if (!message || depth > 4) return "";
  const conversation = text(field(message, "conversation"));
  if (conversation) return conversation;

  const extended = asRecord(field(message, "extendedTextMessage"));
  const extendedText = text(extended && field(extended, "text"));
  if (extendedText) return extendedText;

  for (const kind of ["imageMessage", "videoMessage", "documentMessage"]) {
    const media = asRecord(field(message, kind));
    const caption = text(media && field(media, "caption"));
    if (caption) return caption;
  }

  const buttons = asRecord(field(message, "buttonsResponseMessage"));
  const buttonText = text(buttons && field(buttons, "selectedDisplayText"));
  if (buttonText) return buttonText;

  const template = asRecord(field(message, "templateButtonReplyMessage"));
  const templateText = text(template && field(template, "selectedDisplayText"));
  if (templateText) return templateText;

  const list = asRecord(field(message, "listResponseMessage"));
  const listText = text(list && field(list, "title"));
  if (listText) return listText;

  // An edit sent as a protocol message carries the new content inside.
  const protocol = asRecord(field(message, "protocolMessage"));
  const edited = protocolText(protocol, depth);
  if (edited) return edited;

  for (const wrapper of WRAPPERS) {
    const envelope = asRecord(field(message, wrapper));
    const inner = asRecord(envelope && field(envelope, "message"));
    const found = protoText(inner, depth + 1);
    if (found) return found;
  }
  return "";
}

function protocolText(protocol: Rec | null, depth: number) {
  return protocol ? protoText(asRecord(field(protocol, "editedMessage")), depth + 1) : "";
}

/** A WEBJS media thumbnail: long base64 without spaces (a real message this long always has spaces). */
export function looksLikeBase64(value: string): boolean {
  return value.length >= 120 && !/\s/.test(value) && /^[A-Za-z0-9+/=_-]+$/.test(value);
}

export function extractWahaMessageText(payload: Rec): string {
  const direct = text(payload.body) || text(payload.caption);
  if (direct) return direct;

  const data = asRecord(payload._data);
  if (!data) return "";
  // WEBJS puts the base64 thumbnail of a media message in `_data.body`: on
  // anything that is not a chat only the caption is text.
  const isChat = data.type === undefined || data.type === "chat";
  // Without a type, a long run of base64 with no spaces is a thumbnail, never text (Vigia, 09/11).
  const chatBody = isChat && !looksLikeBase64(text(data.body)) ? text(data.body) : "";
  const legacy = isChat ? chatBody : text(data.caption);
  if (legacy) return legacy;

  return protoText(asRecord(data.message) ?? asRecord(data.Message));
}
