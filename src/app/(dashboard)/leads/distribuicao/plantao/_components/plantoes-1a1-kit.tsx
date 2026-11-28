"use client";

/**
 * Peças da aba Plantões 1:1 (27/11/2026, artifact "Distribuição · Plantões"): o molde `.sheet` (480px à direita, véu,
 * cabeçalho de 22px com selos e fechar de 44px, corpo que rola, rodapé fixo com o primário azul e o ⋯), seções,
 * campos em pílula de 44px, segmented, switch, menu suspenso e o diálogo de confirmação no mesmo estilo.
 * Marcação nova com o CSS module do artifact; abre no portal do Lite, por cima de tudo.
 */
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useArcPortalTarget } from "@/components/arc/arc-scope-context";
import { cn } from "@/lib/utils";
import { typeColor } from "./duty-type-tag";

import s from "./plantoes-1a1.module.css";

export { s as pl };

export function CloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;
}
export function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
}
export function DotsIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>;
}
export function ChevronIcon({ open, className }: { open?: boolean; className?: string }) {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className={cn(s.chev, open && s.chevOpen, className)}><path d="m6 9 6 6 6-6" /></svg>;
}
export function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
}
export function WarnIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>;
}

/** O ponto na cor do tipo (o único uso do hue do tipo, junto com a faixa de 3px). */
export function TypeDot({ hue, name, small }: { hue: number | null | undefined; name?: string | null; small?: boolean }) {
  return <span className={cn(s.dot, small && s.dotSm)} style={{ background: name === null ? "var(--text-muted)" : typeColor(hue) }} aria-hidden="true" />;
}

/** Ponto e nome do tipo ("Sem tipo" quando não há). */
export function TypeName({ name, hue }: { name: string | null | undefined; hue: number | null | undefined }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}><TypeDot hue={hue} name={name ?? null} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name ?? "Sem tipo"}</span></span>;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toLocaleUpperCase("pt-BR");
}

/** A gaveta do artifact. `footer` é o rodapé fixo; `badges` fica abaixo do título. */
export function PlSheet({
  open, onOpenChange, title, description, badges, children, footer, wide, closeLabel = "Fechar", width, lead,
}: {
  /** Largura própria (a gaveta do corretor da página do plantão tem 520px). */
  width?: number;
  /** Antes do título (o avatar do corretor). */
  lead?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  badges?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  closeLabel?: string;
}) {
  const container = useArcPortalTarget();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogPrimitive.Portal container={container ?? undefined}>
        <div className={cn("arc-venancor", s.gx)} data-skin="diretor" style={{ display: "contents" }}>
          <DialogPrimitive.Backdrop className={s.scrim} />
          <DialogPrimitive.Popup className={cn(s.sheet, wide && s.sheetWide)} style={width ? { width: `min(${width}px, 100vw)` } : undefined}>
            <div className={s.sheetHead}>
              {lead}
              <div className={s.sheetHeadText} style={lead ? { flex: 1 } : undefined}>
                <DialogPrimitive.Title className={s.sheetTitle}>{title}</DialogPrimitive.Title>
                {description ? <DialogPrimitive.Description className={s.sheetDesc}>{description}</DialogPrimitive.Description> : null}
                {badges ? <span className={s.badges}>{badges}</span> : null}
              </div>
              <DialogPrimitive.Close className={cn(s.iconbtn, s.iconbtnGhost)} aria-label={closeLabel}><CloseIcon /></DialogPrimitive.Close>
            </div>
            <div className={s.sheetBody}>{children}</div>
            {footer ? <div className={s.sheetFoot}>{footer}</div> : null}
          </DialogPrimitive.Popup>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Confirmação no mesmo estilo (título, texto, Cancelar e a ação). */
export function PlConfirm({
  open, onOpenChange, title, description, confirmLabel, onConfirm, danger, pending, cancelLabel = "Cancelar",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: ReactNode;
  onConfirm: () => void;
  danger?: boolean;
  pending?: boolean;
  cancelLabel?: string;
}) {
  const container = useArcPortalTarget();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogPrimitive.Portal container={container ?? undefined}>
        <div className={cn("arc-venancor", s.gx)} data-skin="diretor" style={{ display: "contents" }}>
          <DialogPrimitive.Backdrop className={cn(s.scrim, s.dialogScrim)} />
          <DialogPrimitive.Popup className={s.dialog}>
            <DialogPrimitive.Title className={s.h3}>{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className={s.p}>{description}</DialogPrimitive.Description>
            <div className={s.dialogFoot}>
              <button type="button" className={cn(s.pill, s.pillQuiet)} onClick={() => onOpenChange(false)} disabled={pending}>{cancelLabel}</button>
              <button type="button" className={cn(s.pill, danger ? s.pillDangerSolid : s.pillPrimary)} onClick={onConfirm} disabled={pending}>{confirmLabel}</button>
            </div>
          </DialogPrimitive.Popup>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function PlSection({ title, aside, hint, children, id }: { title: ReactNode; aside?: ReactNode; hint?: ReactNode; children?: ReactNode; id?: string }) {
  return (
    <section className={s.section} aria-labelledby={id}>
      <div className={s.sectionRow}>
        <h3 id={id} className={s.h4}>{title}</h3>
        {aside}
      </div>
      {hint ? <p className={s.small}>{hint}</p> : null}
      {children}
    </section>
  );
}

export function PlField({ label, htmlFor, hint, children, as = "label" }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; children: ReactNode; as?: "label" | "p" }) {
  return (
    <div className={s.field}>
      {as === "label" ? <label className={s.label} htmlFor={htmlFor}>{label}</label> : <p className={s.label} style={{ margin: 0 }}>{label}</p>}
      {children}
      {hint ? <p className={s.small}>{hint}</p> : null}
    </div>
  );
}

/** Select nativo em pílula (lista do sistema; 16px no celular). */
export function PlSelect({ value, onChange, options, className, ...rest }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <select {...rest} className={cn(s.select, className)} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

export function PlSegmented<T extends string>({ value, onChange, options, label, disabled }: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: ReactNode; sub?: ReactNode }>;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className={s.segment} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className={s.segbtn} disabled={disabled} onClick={() => onChange(option.value)}>
          {option.label}
          {option.sub ? <span className={s.segSub}>{option.sub}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function PlSwitch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={s.switchrow}>
      <button type="button" role="switch" aria-checked={checked} className={s.sw} disabled={disabled} onClick={() => onChange(!checked)} />
      {label}
    </label>
  );
}

export function PlCheck({ checked, onChange, label, disabled, ariaLabel }: { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; disabled?: boolean; ariaLabel?: string }) {
  return (
    <label className={s.check}>
      <input type="checkbox" className={s.checkBox} checked={checked} disabled={disabled} aria-label={ariaLabel} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export function PlStepper({ value, onChange, label, disabled, max = 62 }: { value: number; onChange: (value: number) => void; label: string; disabled?: boolean; max?: number }) {
  const clamp = (next: number) => Math.min(max, Math.max(0, Number.isFinite(next) ? Math.trunc(next) : 0));
  return (
    <span className={s.stepper}>
      <button type="button" className={cn(s.iconbtn, s.iconbtnGhost, s.iconbtnSm)} aria-label={`Diminuir ${label}`} disabled={disabled || value === 0} onClick={() => onChange(clamp(value - 1))}>−</button>
      <input className={s.input} aria-label={label} type="number" min={0} max={max} value={value} onFocus={(event) => event.target.select()} onChange={(event) => onChange(clamp(Number(event.target.value)))} disabled={disabled} />
      <button type="button" className={cn(s.iconbtn, s.iconbtnGhost, s.iconbtnSm)} aria-label={`Aumentar ${label}`} disabled={disabled || value >= max} onClick={() => onChange(clamp(value + 1))}><PlusIcon /></button>
    </span>
  );
}

/** Busca + "+" (o SearchAddList no molde do artifact): resultados aparecem ao digitar. */
export function PlSearchAdd({ items, onAdd, placeholder, emptyLabel, addingId, disabled }: {
  items: ReadonlyArray<{ id: string; label: string; hint?: ReactNode; keywords?: string }>;
  onAdd: (item: { id: string; label: string }) => void;
  placeholder: string;
  emptyLabel: string;
  addingId?: string | null;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  const found = needle ? items.filter((item) => `${item.label} ${item.keywords ?? ""}`.toLocaleLowerCase("pt-BR").includes(needle)).slice(0, 12) : [];
  return (
    <div className={s.section} style={{ gap: 8 }}>
      <label className={s.searchField}>
        <SearchIcon />
        <span className={s.srOnly}>{placeholder}</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} disabled={disabled} />
      </label>
      {needle ? (
        <div className={s.results}>
          {found.length ? found.map((item) => (
            <div key={item.id} className={s.row}>
              <span className={s.av} aria-hidden="true">{initials(item.label)}</span>
              <span className={s.rowBody}><span className={s.rowName}>{item.label}</span>{item.hint ? <span className={s.rowMeta}>{item.hint}</span> : null}</span>
              <button type="button" className={cn(s.iconbtn, s.iconbtnGhost)} aria-label={`Adicionar ${item.label}`} disabled={disabled || addingId === item.id} onClick={() => { onAdd(item); setQuery(""); }}>
                {addingId === item.id ? "…" : <PlusIcon />}
              </button>
            </div>
          )) : <p className={cn(s.small, s.row)}>{emptyLabel}</p>}
        </div>
      ) : null}
    </div>
  );
}

/** Menu suspenso (Configurações ▾ e ⋯): portal no escopo do Lite, por cima dos cartões. */
export function PlMenu({ trigger, triggerClassName, triggerLabel, items, align = "end", side = "bottom" }: {
  trigger: ReactNode;
  triggerClassName: string;
  triggerLabel?: string;
  items: ReadonlyArray<{ label: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean } | null | false>;
  align?: "start" | "end";
  side?: "top" | "bottom";
}) {
  const container = useArcPortalTarget();
  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger className={triggerClassName} aria-label={triggerLabel}>{trigger}</MenuPrimitive.Trigger>
      <MenuPrimitive.Portal container={container ?? undefined}>
        <MenuPrimitive.Positioner align={align} side={side} sideOffset={8} style={{ zIndex: 90 }} className={cn("arc-venancor", s.gx)} data-skin="diretor">
          <MenuPrimitive.Popup className={s.menu}>
            {items.filter(Boolean).map((item, index) => {
              const entry = item as { label: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean };
              return (
                <MenuPrimitive.Item key={index} className={cn(s.menuitem, entry.danger && s.menuitemDanger)} disabled={entry.disabled} onClick={entry.onSelect}>
                  {entry.label}
                </MenuPrimitive.Item>
              );
            })}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

/**
 * Explicação recolhida num "?" (28/11/2026, direção limpa): o texto que ficava fixo embaixo do título abre num
 * balão ao clicar e fecha com outro clique, Esc ou clique fora.
 */
export function PlInfo({ label, children, align = "start" }: { label: string; children: ReactNode; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  return (
    <span ref={ref} className={s.info}>
      <button type="button" className={s.infoBtn} aria-label={label} aria-expanded={open} onClick={() => setOpen((value) => !value)}>?</button>
      {open ? <span role="note" className={cn(s.infoPop, align === "end" && s.infoPopEnd)}>{children}</span> : null}
    </span>
  );
}
