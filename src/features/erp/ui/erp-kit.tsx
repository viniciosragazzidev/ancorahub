"use client";
/**
 * ERP building blocks that follow docs/design-system.md "Product Density" in both systems:
 * - list of entities = one table (standard: Card overview + SectionCardHeader + DataTable; Lite: LiteResponsiveData);
 * - details open in a right drawer (standard: Sheet; Lite: LiteSidePanel / BottomSheet on phones);
 * - row actions in a `⋯` menu (standard: DropdownMenu; Lite: LiteMenu); page extras in "Configurações ▾";
 * - filters change the URL (server filtering), pagination is by URL.
 * Screens never re-create these per page.
 */
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown } from "lucide-react";
import { DotsThreeVertical } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
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

export type ErpColumn<T> = LiteColumn<T>;
export type ErpMenuItem = LiteMenuItem;

/** Card section with a title, a short description and header actions (one primary CTA at most). */
export function ErpSection({ icon, title, description, actions, children }: { icon?: ReactNode; title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const skin = useErpSkin();
  if (skin === "lite") return <section className={page.card} aria-label={title}><header className={page.cardHead}><div><h2 className={page.cardTitle}>{title}</h2>{description ? <p className={page.cardDescription}>{description}</p> : null}</div>{actions ? <div className={page.toolbarEnd}>{actions}</div> : null}</header>{children}</section>;
  return <Card variant="overview"><SectionCardHeader icon={icon} title={title} description={description} actions={actions} /><CardContent className="p-4">{children}</CardContent></Card>;
}

/** The entity list of a screen. Row click opens the drawer; numbers are right aligned and tabular. */
export function ErpList<T>({ icon, title, description, actions, columns, rows, rowKey, onRowOpen, emptyTitle, emptyText, footer }: {
  icon?: ReactNode; title: string; description?: ReactNode; actions?: ReactNode; columns: ErpColumn<T>[]; rows: T[]; rowKey: (row: T) => string;
  onRowOpen?: (row: T) => void; emptyTitle: string; emptyText: string; footer?: ReactNode;
}) {
  const skin = useErpSkin();
  const empty = skin === "lite" ? <div className={page.empty}><p className={page.emptyTitle}>{emptyTitle}</p><p className={page.emptyText}>{emptyText}</p></div> : <EmptyState title={emptyTitle} description={emptyText} />;
  if (skin === "lite") return <section className={page.card} aria-label={title}><header className={page.cardHead}><div><h2 className={page.cardTitle}>{title}</h2>{description ? <p className={page.cardDescription}>{description}</p> : null}</div>{actions ? <div className={page.toolbarEnd}>{actions}</div> : null}</header>
    <LiteResponsiveData caption={title} columns={columns} rows={rows} rowKey={rowKey} onRowOpen={onRowOpen} empty={empty} />{footer}</section>;
  const definitions: ColumnDef<T, unknown>[] = columns.map((column) => ({ id: column.id, header: () => <span className={column.numeric ? "block text-right" : undefined}>{column.label}</span>,
    cell: ({ row }) => <div className={column.numeric ? "text-right tabular-nums" : column.nowrap ? "truncate whitespace-nowrap" : undefined}>{column.render(row.original)}</div>, enableSorting: false }));
  return <Card variant="overview"><SectionCardHeader icon={icon} title={title} description={description} actions={actions} />
    <CardContent className="p-4"><DataTable columns={definitions} data={rows} showColumnToggle={false} showPagination={false} pageSize={Math.max(rows.length, 1)} emptyState={empty} onRowClick={onRowOpen} />{footer}</CardContent></Card>;
}

/** Right drawer for details and short forms (Sheet / LiteSidePanel). */
export function ErpPanel({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode }) {
  const skin = useErpSkin();
  if (skin === "lite") return <LiteSidePanel open={open} onOpenChange={onOpenChange} title={title} description={description}><div className={page.stack}>{children}</div></LiteSidePanel>;
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent><SheetHeader><SheetTitle>{title}</SheetTitle>{description ? <SheetDescription>{description}</SheetDescription> : null}</SheetHeader><SheetBody contentClassName="flex flex-col gap-4">{children}</SheetBody></SheetContent></Sheet>;
}

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

/** URL filter (server-side filtering). Resets the page. */
export function ErpUrlFilter({ label, param, value, options, defaultValue = "" }: { label: string; param: string; value: string; options: { value: string; label: string }[]; defaultValue?: string }) {
  const skin = useErpSkin();
  const navigate = useUrlParam();
  if (skin === "lite") return <LiteUrlSelect label={label} param={param} value={value} options={options} defaultValue={defaultValue} resetPage />;
  // The label comes from the options, so the current value reads correctly before the list is ever opened.
  return <Select value={value} onValueChange={(next: string) => navigate(param, next === defaultValue ? null : next)}>
    <SelectTrigger aria-label={label} className="w-full sm:w-52"><SelectValue placeholder={label}>{(current: string | null) => options.find((option) => option.value === current)?.label ?? label}</SelectValue></SelectTrigger>
    <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
}

/** Month filter (competence). */
export function ErpMonthFilter({ label = "Competência", param = "competence", value }: { label?: string; param?: string; value: string }) {
  const navigate = useUrlParam();
  return <Input type="month" aria-label={label} value={value} onChange={(event) => navigate(param, event.target.value || null)} className="w-full sm:w-44" />;
}

function useUrlParam() {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams(); const [, start] = useTransition();
  return (param: string, value: string | null) => {
    const query = new URLSearchParams(params.toString());
    if (value === null) query.delete(param); else query.set(param, value);
    query.delete("page");
    start(() => router.push(`${pathname}${query.toString() ? `?${query}` : ""}`));
  };
}

/** URL pagination for server-paginated lists. */
export function ErpPager({ page: current, total, pageSize, label = "Paginação" }: { page: number; total: number; pageSize: number; label?: string }) {
  const skin = useErpSkin(); const router = useRouter(); const pathname = usePathname(); const params = useSearchParams(); const [pending, start] = useTransition();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const href = (target: number) => { const query = new URLSearchParams(params.toString()); if (target <= 1) query.delete("page"); else query.set("page", String(target)); return `${pathname}${query.toString() ? `?${query}` : ""}`; };
  if (totalPages <= 1) return null;
  if (skin === "lite") return <LitePagination page={current} totalPages={totalPages} totalItems={total} pageSize={pageSize} pending={pending} label={label} onPageChange={(target) => start(() => router.push(href(target)))} />;
  return <nav aria-label={label} className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{total} registro(s) · página {current} de {totalPages}</span>
    <div className="flex gap-2">{current > 1 ? <Button variant="outline" size="sm" render={<Link href={href(current - 1)} />}>Anterior</Button> : null}{current < totalPages ? <Button variant="outline" size="sm" render={<Link href={href(current + 1)} />}>Próxima</Button> : null}</div></nav>;
}

/** Row of KPI tiles (`StatCard` children) in the grid of the viewer's skin. */
export function ErpStats({ children }: { children: ReactNode }) {
  const skin = useErpSkin();
  return <div className={skin === "lite" ? page.stats : "grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"}>{children}</div>;
}

/** Filter bar above a list. */
export function ErpToolbar({ children }: { children: ReactNode }) {
  const skin = useErpSkin();
  return <div className={skin === "lite" ? page.toolbar : "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"}>{children}</div>;
}

/** Short contextual note (rules of the screen) — muted text, never a colored panel. */
export function ErpNote({ children }: { children: ReactNode }) {
  const skin = useErpSkin();
  return <p className={skin === "lite" ? page.muted : "text-xs leading-5 text-muted-foreground"}>{children}</p>;
}
