type ChromeTab = { id?: number; windowId?: number; url?: string; status?: string };
type ChromeSender = { id?: string; url?: string; tab?: ChromeTab };
type ChromeMessage = { type?: string; payload?: Record<string, unknown>; target?: string };
type ChromeResponse = { ok?: boolean; status?: number; body?: Record<string, unknown>; retryAfter?: number; geracao?: string | null };
type ChromePort = {
  name: string;
  onDisconnect: { addListener: (listener: () => void) => void };
  onMessage: { addListener: (listener: (message: ChromeMessage) => void) => void };
  postMessage: (message: unknown) => void;
  disconnect: () => void;
};
type ChromeAlarm = { name: string; scheduledTime: number; periodInMinutes?: number };

declare const chrome: {
  runtime: {
    id: string;
    lastError?: { message?: string };
    getManifest: () => { version: string };
    getURL: (path: string) => string;
    connect: (options: { name: string }) => ChromePort;
    onMessage: { addListener: (listener: (message: ChromeMessage, sender: ChromeSender, sendResponse: (value: unknown) => void) => boolean | void) => void };
    onMessageExternal: { addListener: (listener: (message: ChromeMessage, sender: ChromeSender, sendResponse: (value: unknown) => void) => boolean | void) => void };
    onConnect: { addListener: (listener: (port: ChromePort) => void) => void };
    onStartup: { addListener: (listener: () => void) => void };
    onInstalled: { addListener: (listener: () => void) => void };
    sendMessage: {
      (message: unknown, callback?: (response: unknown) => void): void;
      (extensionId: string, message: unknown, callback?: (response: unknown) => void): void;
    };
  };
  storage: {
    session: { get: (key: string) => Promise<Record<string, unknown>>; set: (value: Record<string, unknown>) => Promise<void>; remove: (key: string | string[]) => Promise<void> };
    local: { get: (key: string) => Promise<Record<string, unknown>>; set: (value: Record<string, unknown>) => Promise<void>; remove: (key: string | string[]) => Promise<void> };
  };
  tabs: {
    create: (options: { url: string; active?: boolean }) => Promise<ChromeTab>;
    update: (tabId: number, options: { active?: boolean }) => Promise<ChromeTab>;
    query: (options: { url?: string; active?: boolean; currentWindow?: boolean }) => Promise<ChromeTab[]>;
    sendMessage: (tabId: number, message: unknown, callback?: (response: unknown) => void) => void;
    onUpdated: { addListener: (listener: (tabId: number, changeInfo: { status?: string }, tab: ChromeTab) => void) => void };
  };
  windows: { update: (windowId: number, info: { focused?: boolean }) => Promise<unknown> };
  action: {
    setBadgeText: (details: { text: string }) => Promise<void>;
    setBadgeBackgroundColor: (details: { color: string }) => Promise<void>;
    setBadgeTextColor: (details: { color: string }) => Promise<void>;
  };
  alarms: {
    create: (name: string, info: { when?: number; periodInMinutes?: number }) => void;
    clear: (name: string) => Promise<boolean>;
    onAlarm: { addListener: (listener: (alarm: ChromeAlarm) => void) => void };
  };
  notifications: {
    create: (id: string, options: { type: "basic"; iconUrl: string; title: string; message: string; priority?: number }) => Promise<string>;
    clear: (id: string) => Promise<boolean>;
    onClicked: { addListener: (listener: (notificationId: string) => void) => void };
  };
  offscreen: {
    hasDocument: () => Promise<boolean>;
    createDocument: (options: { url: string; reasons: ["AUDIO_PLAYBACK"]; justification: string }) => Promise<void>;
    closeDocument: () => Promise<void>;
  };
};
