"use client";
/**
 * ERP building blocks that follow docs/design-system.md "Product Density" in both systems, modeled on the reviewed
 * Director Lite screens (/clientes, /equipe):
 * - page header: title, one primary CTA (`ErpPrimaryAction`) and at most one neutral action (`ErpHelp`, a menu);
 * - numbers first (`ErpStats` of `StatCard`), then the filter bar (`ErpToolbar` with `ErpSearch`, `ErpUrlFilter`,
 *   `ErpMonthFilter`), then one table (`ErpList`): Lite renders it flat like /clientes, standard in a Card like /equipe;
 * - details open in a right drawer (`ErpPanel`), row actions in a `⋯` menu (`ErpRowMenu`);
 * - screen rules live behind "Como funciona" (`ErpHelp`), never as a paragraph on top of the screen;
 * - filters, search, drawers and pagination live in the URL (server filtering).
 * Screens never re-create these per page.
 */
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, Plus, Search } from "lucide-react";
import { DotsThreeVertical } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { DataTable } from "@/components/ui/data-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { LiteMenu, LiteUrlSelect, type LiteMenuItem } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination } from "@/components/lite/data/pagination";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import page from "@/components/lite/page/lite-page.module.css";
import { useErpSkin } from "./skin-context";
import { competenceOptions, plural } from "./format";
import kit from "./erp-kit.module.css";

export type ErpColumn<T> = LiteColumn<T>;
export type ErpMenuItem = LiteMenuItem;
export type ErpTone = "neutral" | "success" | "warning" | "danger" | "info";

// ─── URL state ──────────────────────────────────────────────────────────────

function useUrlUpdate() {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams(); const [pending, start] = useTransition();
  const update = useCallback((changes: Record<string, string | null>, options: { resetPage?: boolean; replace?: boolean } = {}) => {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) { if (value === null || value === "") query.delete(key); else query.set(key, value); }
    if (options.resetPage !== false) query.delete("page");
    const target = `${pathname}${query.toString() ? `?${query}` : ""}`;
    start(() => (options.replace ? router.replace(target, { scroll: false }) : router.push(target, { scroll: false })));
  }, [params, pathname, router]);
  return { update, pending, params };
}

/**
 * A drawer opened by the URL (`?novo=1`, `?repasse=<id>`): the header CTA is a plain link, so the primary action can
 * live in the page header while the drawer belongs to the list component. Closing removes the parameter.
 */
export function useUrlPanel(param: string) {
  const { update, params } = useUrlUpdate();
  const value = params.get(param);
  const close = useCallback(() => update({ [param]: null }, { resetPage: false, replace: true }), [param, update]);
  return { value, open: value !== null, close };
}

// ─── Page header ────────────────────────────────────────────────────────────

/** Header slot: the screen's actions, neutral first and the single primary last (like /equipe). */
export function ErpHeaderActions({ children }: { children: ReactNode }) {
  return <div className={kit.headerActions}>{children}</div>;
}

/** The screen's single primary action. It opens the screen drawer through the URL (`?novo=1` by default) or navigates to `href`. */
export function ErpPrimaryAction({ label, param = "novo", href }: { label: string; param?: string; href?: string }) {
  const skin = useErpSkin(); const pathname = usePathname(); const params = useSearchParams();
  const target = href ?? (() => { const query = new URLSearchParams(params.toString()); query.set(param, "1"); return `${pathname}?${query}`; })();
  const content = <><Plus aria-hidden="true" size={16} />{label}</>;
  if (skin === "lite") return <Link href={target} scroll={false} className={page.primaryButton}>{content}</Link>;
  return <Button render={<Link href={target} scroll={false} />}>{content}</Button>;
}

/** "Como funciona": the rules of the screen in a drawer, instead of a paragraph on top of the list. */
export function ErpHelp({ title, children, label = "Como funciona" }: { title: string; children: ReactNode; label?: string }) {
  const skin = useErpSkin(); const [open, setOpen] = useState(false);
  const trigger = skin === "lite"
    ? <button type="button" className={page.button} onClick={() => setOpen(true)}>{label}</button>
    : <Button type="button" variant="outline" onClick={() => setOpen(true)}>{label}</Button>;
  return <>{trigger}<ErpPanel open={open} onOpenChange={setOpen} title={title}><div className={kit.helpText}>{children}</div></ErpPanel></>;
}

// ─── Content blocks ─────────────────────────────────────────────────────────

/** Card section with a title, a short description and header actions (secondary content only). */
export function ErpSection({ icon, title, description, actions, children }: { icon?: ReactNode; title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const skin = useErpSkin();
  if (skin === "lite") return <section className={page.card} aria-label={title}><header className={kit.listHead}><div className={page.cardHead}><h2 className={page.cardTitle}>{title}</h2>{description ? <p className={page.cardDescription}>{description}</p> : null}</div>{actions ? <div className={kit.headerActions}>{actions}</div> : null}</header>{children}</section>;
  return <Card variant="overview"><SectionCardHeader icon={icon} title={title} description={description} actions={actions} /><CardContent className="p-4">{children}</CardContent></Card>;
}

/**
 * The entity list of a screen. Row click opens the drawer; numbers are right aligned and tabular.
 * `count` is the total behind the filters (pagination included); it is shown next to the title.
 */
export function ErpList<T>({ icon, title, description, actions, columns, rows, rowKey, onRowOpen, emptyTitle, emptyText, footer, count, countLabel }: {
  icon?: ReactNode; title: string; description?: ReactNode; actions?: ReactNode; columns: ErpColumn<T>[]; rows: T[]; rowKey: (row: T) => string;
  onRowOpen?: (row: T) => void; emptyTitle: string; emptyText: string; footer?: ReactNode; count?: number; countLabel?: [string, string];
}) {
  const skin = useErpSkin();
  const total = count ?? rows.length;
  const countText = countLabel ? plural(total, countLabel[0], countLabel[1]) : null;
  if (skin === "lite") {
    const empty = <div className={page.empty}><p className={page.emptyTitle}>{emptyTitle}</p><p className={page.emptyText}>{emptyText}</p></div>;
    return <section className={page.group} aria-label={title}>
      <header className={kit.listHead}>
        <div className={kit.listTitle}><h2 className={page.sectionTitle}>{title}</h2>{countText && rows.length ? <span className={kit.count}>{countText}</span> : null}</div>
        {actions ? <div className={kit.headerActions}>{actions}</div> : null}
      </header>
      {description ? <p className={page.cardDescription}>{description}</p> : null}
      {rows.length ? <LiteResponsiveData caption={title} columns={columns} rows={rows} rowKey={rowKey} onRowOpen={onRowOpen} empty={empty} /> : empty}
      {footer}
    </section>;
  }
  const empty = <EmptyState title={emptyTitle} description={emptyText} />;
  const definitions: ColumnDef<T, unknown>[] = columns.map((column) => ({ id: column.id, header: () => <span className={column.numeric ? "block text-right" : undefined}>{column.label}</span>,
    cell: ({ row }) => <div className={column.numeric ? "text-right tabular-nums" : column.nowrap ? "truncate whitespace-nowrap" : undefined}>{column.render(row.original)}</div>, enableSorting: false }));
  const headerDescription = countText && rows.length ? (description ? <>{countText} · {description}</> : countText) : description;
  return <Card variant="overview"><SectionCardHeader icon={icon} title={title} description={headerDescription} actions={actions} />
    <CardContent className="p-4"><DataTable columns={definitions} data={rows} showColumnToggle={false} showPagination={false} pageSize={Math.max(rows.length, 1)} emptyState={empty} onRowClick={onRowOpen} />{footer}</CardContent></Card>;
}

/** Right drawer for details and short forms (Sheet / LiteSidePanel). */
export function ErpPanel({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode }) {
  const skin = useErpSkin();
  if (skin === "lite") return <LiteSidePanel open={open} onOpenChange={onOpenChange} title={title} description={description}><div className={page.stack}>{children}</div></LiteSidePanel>;
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent><SheetHeader><SheetTitle>{title}</SheetTitle>{description ? <SheetDescription>{description}</SheetDescription> : null}</SheetHeader><SheetBody contentClassName="flex flex-col gap-4">{children}</SheetBody></SheetContent></Sheet>;
}

/** Status pill with text (never color alone). */
export function ErpStatus({ tone = "neutral", children }: { tone?: ErpTone; children: ReactNode }) {
  const skin = useErpSkin();
  if (skin === "lite") return <span className={page.badge} data-tone={tone === "neutral" ? undefined : tone}>{children}</span>;
  const variant = tone === "danger" ? "destructive" : tone === "success" ? "success" : tone === "warning" ? "warning" : tone === "info" ? "info" : "secondary";
  return <Badge variant={variant as "secondary"}>{children}</Badge>;
}

/** Two-line cell: the human title and a muted secondary line (reference, date, person). */
export function ErpCell({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  const skin = useErpSkin();
  if (skin === "lite") return <span><span className={page.cellTitle}>{title}</span>{sub ? <span className={page.cellSub}>{sub}</span> : null}</span>;
  return <span className="flex min-w-0 flex-col"><span className="truncate font-medium">{title}</span>{sub ? <span className="truncate text-xs text-muted-foreground">{sub}</span> : null}</span>;
}

// ─── Menus ──────────────────────────────────────────────────────────────────

/** Row actions `⋯`. */
export function ErpRowMenu({ label, items }: { label: string; items: ErpMenuItem[] }) {
  const skin = useErpSkin();
  const router = useRouter();
  if (!items.length) return null;
  // The row itself opens the drawer: clicks on the menu (and on its portal items, which bubble through React) must not.
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
  if (skin === "lite") return <span onClick={stop} onKeyDown={stop}><LiteMenu label={label} items={items} /></span>;
  return <span onClick={stop} onKeyDown={stop}><DropdownMenu><DropdownMenuTrigger render={<Button type="button" aria-label={label} size="icon-sm" variant="ghost"><DotsThreeVertical size={15} /></Button>} />
    <DropdownMenuContent align="end" className="w-52">{items.map((item) => <DropdownMenuItem key={item.id} variant={item.tone === "danger" ? "destructive" : "default"} disabled={"disabled" in item ? item.disabled : undefined}
      onClick={() => { if (item.href) router.push(item.href); else item.onSelect?.(); }}>{item.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></span>;
}

/** Page-level extras ("Configurações ▾"): auxiliary settings and explainers, never the primary action. */
export function ErpSettingsMenu({ label = "Configurações", items }: { label?: string; items: ErpMenuItem[] }) {
  const skin = useErpSkin();
  const router = useRouter();
  if (!items.length) return null;
  if (skin === "lite") return <LiteMenu label={label} items={items} />;
  return <DropdownMenu><DropdownMenuTrigger render={<Button variant="outline">{label}<ChevronDown aria-hidden="true" className="size-3.5" /></Button>} />
    <DropdownMenuContent align="end" className="w-56">{items.map((item) => <DropdownMenuItem key={item.id} disabled={"disabled" in item ? item.disabled : undefined} onClick={() => { if (item.href) router.push(item.href); else item.onSelect?.(); }}>{item.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}

// ─── Filter bar ─────────────────────────────────────────────────────────────

/** Filter bar above a list. */
export function ErpToolbar({ children }: { children: ReactNode }) {
  const skin = useErpSkin();
  return <div className={skin === "lite" ? page.toolbar : "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"}>{children}</div>;
}

/** Search that filters on the server as you type (debounced, `?q=`). Resets the page. */
export function ErpSearch({ label, placeholder, param = "q", value }: { label: string; placeholder: string; param?: string; value: string }) {
  const skin = useErpSkin(); const { update } = useUrlUpdate();
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setText(value); }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const change = (next: string) => {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ [param]: next.trim() || null }, { replace: true }), 350);
  };
  if (skin === "lite") return <label className={page.search}><Search aria-hidden="true" size={18} className={page.searchIcon} />
    <input type="search" value={text} onChange={(event) => change(event.target.value)} placeholder={placeholder} aria-label={label} className={page.searchInput} /></label>;
  return <div className="relative w-full sm:w-72"><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input type="search" value={text} onChange={(event) => change(event.target.value)} placeholder={placeholder} aria-label={label} className="pl-9" /></div>;
}

/** URL filter (server-side filtering). Resets the page. */
export function ErpUrlFilter({ label, param, value, options, defaultValue = "" }: { label: string; param: string; value: string; options: { value: string; label: string }[]; defaultValue?: string }) {
  const skin = useErpSkin();
  const { update } = useUrlUpdate();
  if (skin === "lite") return <LiteUrlSelect className={page.select} label={label} param={param} value={value} options={options} defaultValue={defaultValue} resetPage />;
  // The label comes from the options, so the current value reads correctly before the list is ever opened.
  return <Select value={value} onValueChange={(next: string) => update({ [param]: next === defaultValue ? null : next })}>
    <SelectTrigger aria-label={label} className="w-full sm:w-52"><SelectValue placeholder={label}>{(current: string | null) => options.find((option) => option.value === current)?.label ?? label}</SelectValue></SelectTrigger>
    <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
}

/**
 * Month filter (competence) as a list of named months ("Novembro de 2026"), never the browser's month input.
 * `current` anchors the list (today's period); `allLabel` adds the "every month" option (empty value).
 */
export function ErpMonthFilter({ label = "Competência", param = "competence", value, current, allLabel = "Todos os meses" }: {
  label?: string; param?: string; value: string; current?: string; allLabel?: string | null;
}) {
  const skin = useErpSkin();
  const anchor = current ?? currentMonth();
  const months = competenceOptions(anchor);
  if (value && !months.some((option) => option.value === value)) months.push(...competenceOptions(value, 0, 0));
  const options = allLabel ? [{ value: "", label: allLabel }, ...months] : months;
  if (skin === "lite") return <LiteUrlSelect className={kit.month} label={label} param={param} value={value} options={options} defaultValue="" resetPage />;
  return <ErpUrlFilter label={label} param={param} value={value} options={options} defaultValue="" />;
}

function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Sao_Paulo" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

/** URL pagination for server-paginated lists. */
export function ErpPager({ page: current, total, pageSize, label = "Paginação" }: { page: number; total: number; pageSize: number; label?: string }) {
  const skin = useErpSkin(); const router = useRouter(); const pathname = usePathname(); const params = useSearchParams(); const [pending, start] = useTransition();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const href = (target: number) => { const query = new URLSearchParams(params.toString()); if (target <= 1) query.delete("page"); else query.set("page", String(target)); return `${pathname}${query.toString() ? `?${query}` : ""}`; };
  if (totalPages <= 1) return null;
  if (skin === "lite") return <LitePagination page={current} totalPages={totalPages} totalItems={total} pageSize={pageSize} pending={pending} label={label} onPageChange={(target) => start(() => router.push(href(target), { scroll: false }))} />;
  return <nav aria-label={label} className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{total} registro(s) · página {current} de {totalPages}</span>
    <div className="flex gap-2">{current > 1 ? <Button variant="outline" size="sm" render={<Link href={href(current - 1)} scroll={false} />}>Anterior</Button> : null}{current < totalPages ? <Button variant="outline" size="sm" render={<Link href={href(current + 1)} scroll={false} />}>Próxima</Button> : null}</div></nav>;
}

/** Row of KPI tiles (`StatCard` children) in the grid of the viewer's skin. */
export function ErpStats({ children }: { children: ReactNode }) {
  const skin = useErpSkin();
  return <div className={skin === "lite" ? page.stats : "grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"}>{children}</div>;
}

/** Short contextual note inside drawers and forms — muted text, never a colored panel, never on top of a screen. */
export function ErpNote({ children }: { children: ReactNode }) {
  const skin = useErpSkin();
  return <p className={skin === "lite" ? page.muted : "text-xs leading-5 text-muted-foreground"}>{children}</p>;
}
