"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ─── Types ─── */

export type ShortcutAction = {
  id: string;
  label: string;
  keys: string;
  handler: () => void;
  category?: string;
  preventDefault?: boolean;
};

type ShortcutContextValue = {
  register: (action: ShortcutAction) => () => void;
  shortcuts: ShortcutAction[];
};

const ShortcutContext = createContext<ShortcutContextValue>({
  register: () => () => {},
  shortcuts: [],
});

export function useShortcuts() {
  return useContext(ShortcutContext);
}

/* ─── Helpers ─── */

function isEditableTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  return false;
}

function parseKeys(keys: string) {
  const parts = keys.toLowerCase().split("+").map((p) => p.trim());
  return {
    key: parts[parts.length - 1],
    ctrl: parts.includes("ctrl"),
    meta: parts.includes("meta") || parts.includes("cmd"),
    shift: parts.includes("shift"),
  };
}

function matchKey(e: KeyboardEvent, pattern: ReturnType<typeof parseKeys>): boolean {
  if (e.key.toLowerCase() !== pattern.key) return false;
  if (pattern.ctrl && !e.ctrlKey) return false;
  if (pattern.meta && !e.metaKey) return false;
  if (pattern.shift && !e.shiftKey) return false;
  if (!pattern.ctrl && !pattern.meta && (e.ctrlKey || e.metaKey)) return false;
  // Don't block ? just because it needs Shift to type
  if (!pattern.shift && e.shiftKey && !e.ctrlKey && !e.metaKey && e.key.length > 1) return false;
  return true;
}

/* ─── Sequence detector (for G+D, G+T etc.) ─── */

function useSequenceDetector() {
  const bufferRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detect = useCallback(
    (key: string, sequences: Map<string, () => void>): boolean => {
      bufferRef.current.push(key);
      const current = bufferRef.current.join("");

      // Exact match
      if (sequences.has(current)) {
        sequences.get(current)!();
        bufferRef.current = [];
        if (timerRef.current) clearTimeout(timerRef.current);
        return true;
      }

      // Partial match (buffer is prefix of a sequence)
      let hasPartial = false;
      for (const seq of sequences.keys()) {
        if (seq.startsWith(current)) {
          hasPartial = true;
          break;
        }
      }

      if (!hasPartial) bufferRef.current = [];

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        bufferRef.current = [];
      }, 1000);

      return false;
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return detect;
}

/* ─── Provider ─── */

export function KeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [shortcuts, setShortcuts] = useState<ShortcutAction[]>([]);
  const shortcutsRef = useRef<ShortcutAction[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const detectSequence = useSequenceDetector();

  shortcutsRef.current = shortcuts;

  const register = useCallback((action: ShortcutAction) => {
    setShortcuts((prev) => {
      if (prev.find((s) => s.id === action.id)) return prev;
      return [...prev, action];
    });
    return () => {
      setShortcuts((prev) => prev.filter((s) => s.id !== action.id));
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip when typing in inputs
      if (isEditableTarget(e.target)) {
        if (e.key !== "Escape") return;
      }

      // ? opens/closes help
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
        return;
      }

      // Build sequence map (2-key sequences like "g d", "g t")
      const sequencesMap = new Map<string, () => void>();
      const directActions: ShortcutAction[] = [];

      for (const s of shortcutsRef.current) {
        const seq = s.keys.toLowerCase().split(" ").filter(Boolean);
        if (seq.length === 2) {
          sequencesMap.set(seq.join(""), s.handler);
        } else {
          directActions.push(s);
        }
      }

      // Try sequence detection on unmodified keys
      if (!e.ctrlKey && !e.metaKey && !e.altKey && sequencesMap.size > 0) {
        const handled = detectSequence(e.key.toLowerCase(), sequencesMap);
        if (handled) {
          e.preventDefault();
          return;
        }
      }

      // Try direct shortcuts
      for (const action of directActions) {
        const seq = action.keys.toLowerCase().split(" ").filter(Boolean);
        if (seq.length === 2) continue;

        const pattern = parseKeys(action.keys);
        if (matchKey(e, pattern)) {
          if (action.preventDefault !== false) e.preventDefault();
          action.handler();
          return;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [detectSequence]);

  const value = useMemo(() => ({ register, shortcuts }), [register, shortcuts]);

  return (
    <ShortcutContext.Provider value={value}>
      {children}
      {helpOpen && <KeyboardShortcutsDialog onClose={() => setHelpOpen(false)} />}
    </ShortcutContext.Provider>
  );
}

/* ─── Help Dialog ─── */

function formatKeys(keys: string): string {
  const metaKey =
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac")
      ? "⌘"
      : "Ctrl";
  return keys
    .replace(/\bctrl\b/gi, metaKey)
    .replace(/\bcmd\b/gi, metaKey)
    .replace(/\bmeta\b/gi, metaKey)
    .replace(/\bshift\b/gi, "⇧")
    .replace(/\+/g, " ")
    .trim();
}

export function KeyboardShortcutsDialog({ onClose }: { onClose: () => void }) {
  const { shortcuts } = useShortcuts();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, ShortcutAction[]>();
    for (const s of shortcuts) {
      const cat = s.category ?? "Geral";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0] === "Geral" ? -1 : b[0] === "Geral" ? 1 : a[0].localeCompare(b[0]),
    );
  }, [shortcuts]);

  const builtins: { label: string; keys: string }[] = [
    { label: "Ajuda de atalhos", keys: "?" },
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Atalhos de teclado"
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-border/60 bg-popover shadow-2xl outline-none"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-popover px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Atalhos de teclado</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pressione os atalhos para navegar rapidamente
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-5">
          {grouped.map(([category, items]) => (
            <section key={category}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {category}
              </p>
              <div className="space-y-1.5">
                {items.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-xs hover:bg-muted/30 transition-colors"
                  >
                    <span className="text-foreground">{s.label}</span>
                    <kbd className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {formatKeys(s.keys)}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Sistema
            </p>
            <div className="space-y-1.5">
              {builtins.map((s) => (
                <div
                  key={s.keys}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-xs hover:bg-muted/30 transition-colors"
                >
                  <span className="text-foreground">{s.label}</span>
                  <kbd className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {formatKeys(s.keys)}
                  </kbd>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="border-t border-border/50 px-5 py-3">
          <p className="text-[10px] text-muted-foreground/60 text-center">
            Pressione <kbd className="rounded border border-border bg-muted/50 px-1 font-mono text-[9px]">?</kbd> a qualquer momento para abrir esta janela
          </p>
        </div>
      </div>
    </div>
  );
}
