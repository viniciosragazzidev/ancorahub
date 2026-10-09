"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { Avatar } from "@/components/arc/avatar/avatar";

import { LIGHT_TABS, type LightTabId } from "./light-routes";
import { formatQueueBadge, LIGHT_TAB_ICONS } from "./light-tab-icons";

const itemBase =
  "relative flex w-14 flex-col items-center gap-1 rounded-2xl min-h-14 justify-center py-2 text-xs font-medium transition-colors duration-(--duration-fast) motion-reduce:transition-none";
const itemIdle = "text-(--text-secondary) hover:bg-(--surface-muted)";
const itemActive = "bg-(--foreground) text-(--surface)";

/** Left rail (md and up): same destinations as the bottom bar, 72px wide. */
export function LightSideRail({
  activeTab,
  queueBadgeCount,
  moreOpen,
  onOpenMore,
  brand,
  userName,
}: {
  activeTab: LightTabId;
  queueBadgeCount: number;
  moreOpen: boolean;
  onOpenMore: () => void;
  brand?: { logoUrl: string | null; tenantName: string | null };
  userName: string | null;
}) {
  const MoreIcon = LIGHT_TAB_ICONS.mais;
  const moreActive = activeTab === "mais" || moreOpen;

  return (
    <nav
      aria-label="Navegação principal"
      className="arc-venancor fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col items-center gap-2 border-r border-(--border) bg-(--surface) py-4 md:flex"
    >
      <Link href="/dashboard" aria-label="Ir para o início" className="mb-2 grid size-11 place-items-center rounded-full">
        {brand?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt={brand.tenantName || "Logo"} className="h-7 w-auto max-w-10 object-contain" />
        ) : (
          <span className="grid size-9 place-items-center rounded-full bg-(--accent-subtle) text-sm font-semibold text-(--accent-strong)" aria-hidden="true">
            {(brand?.tenantName || "C").slice(0, 1).toUpperCase()}
          </span>
        )}
      </Link>
      <ul className="flex flex-col items-center gap-1">
        {LIGHT_TABS.map((tab) => {
          const Icon = LIGHT_TAB_ICONS[tab.id];
          const isActive = activeTab === tab.id && !moreOpen;
          const badge = tab.id === "fila" && queueBadgeCount > 0 ? queueBadgeCount : 0;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                aria-label={badge ? `${tab.label}, ${badge} pendentes` : tab.label}
                aria-current={isActive ? "page" : undefined}
                className={cn(itemBase, isActive ? itemActive : itemIdle)}
              >
                <Icon className="size-5" strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
                <span>{tab.label}</span>
                {badge ? (
                  <span
                    aria-hidden="true"
                    className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-(--danger) px-1 text-xs font-semibold leading-none tabular-nums text-(--surface)"
                  >
                    {formatQueueBadge(badge)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            aria-label="Mais"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={onOpenMore}
            className={cn(itemBase, moreActive ? itemActive : itemIdle)}
          >
            <MoreIcon className="size-5" strokeWidth={2.4} aria-hidden="true" />
            <span>Mais</span>
          </button>
        </li>
      </ul>
      <button type="button" onClick={onOpenMore} aria-label="Perfil e disponibilidade" className="mt-auto grid size-11 place-items-center rounded-full">
        <Avatar name={userName || "Corretor"} size="md" className="light-avatar" />
      </button>
    </nav>
  );
}
