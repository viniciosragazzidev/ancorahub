declare const chrome: {
  runtime: { onMessage: { addListener: (listener: (message: { type?: string; payload?: Record<string, unknown> }, sender: unknown, sendResponse: (value: unknown) => void) => boolean) => void }; sendMessage: (message: unknown, callback: (response: { ok: boolean; status: number; body: Record<string, unknown> }) => void) => void };
  storage: { session: { get: (key: string) => Promise<Record<string, string>>; set: (value: Record<string, string>) => Promise<void>; remove: (key: string) => Promise<void> } };
};
