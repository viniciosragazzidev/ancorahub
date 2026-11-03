type Sender = { id?: string; url?: string };
type Mensagem = { type?: string; payload?: Record<string, unknown>; code?: unknown };
type Resposta = { ok: boolean; status: number; body: Record<string, unknown> };

declare const chrome: {
  runtime: {
    id: string;
    lastError?: { message?: string };
    getManifest: () => { version: string };
    onMessage: { addListener: (listener: (message: Mensagem, sender: Sender, sendResponse: (value: unknown) => void) => boolean | void) => void };
    onMessageExternal: { addListener: (listener: (message: Mensagem, sender: Sender, sendResponse: (value: unknown) => void) => boolean | void) => void };
    sendMessage: {
      (message: unknown, callback?: (response: Resposta) => void): void;
      (extensionId: string, message: unknown, callback?: (response: unknown) => void): void;
    };
  };
  storage: {
    session: { get: (key: string) => Promise<Record<string, string>>; set: (value: Record<string, string>) => Promise<void>; remove: (key: string) => Promise<void> };
    local: { get: (key: string) => Promise<Record<string, unknown>>; set: (value: Record<string, unknown>) => Promise<void> };
  };
  tabs: { create: (options: { url: string }) => void };
};
