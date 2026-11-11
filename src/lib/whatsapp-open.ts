import { isMobileWhatsAppDevice, toDeviceWhatsAppUrl, WHATSAPP_WEB_TARGET, type WhatsAppDevice } from "./whatsapp-url";

/** The device of this browser (desktop on the server). */
export function currentWhatsAppDevice(): WhatsAppDevice {
  if (typeof window === "undefined") return "desktop";
  let coarsePointer = false;
  try {
    coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  } catch {
    coarsePointer = false;
  }
  return isMobileWhatsAppDevice({ userAgent: window.navigator.userAgent, coarsePointer }) ? "mobile" : "desktop";
}

/**
 * Opens a WhatsApp send link the right way for the device: WhatsApp Web in the
 * "whatsapp_web" tab on the computer, the app on the phone. Returns false when
 * the link is not a WhatsApp send link (nothing is opened).
 */
export function openWhatsApp(href: string, device: WhatsAppDevice = currentWhatsAppDevice()): boolean {
  const target = toDeviceWhatsAppUrl(href, device);
  if (!target) return false;
  if (device === "mobile") {
    window.location.href = target;
    return true;
  }
  const tab = window.open(target, WHATSAPP_WEB_TARGET);
  try {
    if (tab) tab.opener = null;
  } catch {
    /* cross-origin tab: nothing to detach */
  }
  return true;
}

export type PendingWhatsApp = {
  /** Sends the tab (or the phone) to the WhatsApp link once it is known. */
  go: (href: string) => boolean;
  /** Closes the tab opened for this click (never a WhatsApp tab already in use). */
  cancel: () => void;
};

function isBlank(tab: Window) {
  try {
    return tab.location.href === "about:blank";
  } catch {
    return false;
  }
}

/**
 * For "accept, then open": call it synchronously inside the click so the
 * computer opens the WhatsApp Web tab before the await (popup blockers only
 * allow a tab in the click itself), then `go` or `cancel` after the result.
 */
export function prepareWhatsAppWindow(device: WhatsAppDevice = currentWhatsAppDevice()): PendingWhatsApp {
  let tab: Window | null = null;
  if (device === "desktop") {
    tab = window.open("", WHATSAPP_WEB_TARGET);
    if (tab && isBlank(tab)) {
      try {
        tab.document.title = "Abrindo o WhatsApp Web";
        tab.document.body.style.cssText = "font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;color:#3b4a54";
        tab.document.body.textContent = "Abrindo o WhatsApp Web...";
      } catch {
        /* cosmetic only */
      }
    }
  }
  return {
    go(href) {
      const target = toDeviceWhatsAppUrl(href, device);
      if (!target) {
        this.cancel();
        return false;
      }
      if (device === "mobile") {
        window.location.href = target;
        return true;
      }
      if (tab && !tab.closed) {
        tab.location.href = target;
        try {
          tab.opener = null;
        } catch {
          /* already cross-origin */
        }
        return true;
      }
      return openWhatsApp(href, device);
    },
    cancel() {
      if (tab && !tab.closed && isBlank(tab)) tab.close();
      tab = null;
    },
  };
}

export type AutoOpenResult = "opened" | "failed";

/**
 * Aceite com contador (11/11): abre o WhatsApp sem um toque recente (depois dos 30 s). Os navegadores
 * costumam barrar: no computador `window.open` volta nulo; no celular a página continua visível
 * (o app não abriu). Em `failed`, a tela pede um toque, que sempre funciona.
 */
export function tryOpenWhatsAppWithoutGesture(href: string, device: WhatsAppDevice = currentWhatsAppDevice(), waitMs = 1500): Promise<AutoOpenResult> {
  const target = toDeviceWhatsAppUrl(href, device);
  if (!target || typeof window === "undefined") return Promise.resolve("failed");
  if (device === "desktop") {
    let tab: Window | null = null;
    try {
      tab = window.open(target, WHATSAPP_WEB_TARGET);
    } catch {
      tab = null;
    }
    if (!tab) return Promise.resolve("failed");
    try {
      tab.opener = null;
    } catch {
      /* cross-origin tab: nothing to detach */
    }
    return Promise.resolve("opened");
  }
  return new Promise((resolve) => {
    let left = false;
    const onHide = () => {
      if (document.visibilityState === "hidden") left = true;
    };
    const onPageHide = () => { left = true; };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("blur", onPageHide);
    try {
      window.location.href = target;
    } catch {
      /* blocked: resolved as failed below */
    }
    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("blur", onPageHide);
      resolve(left ? "opened" : "failed");
    }, waitMs);
  });
}
