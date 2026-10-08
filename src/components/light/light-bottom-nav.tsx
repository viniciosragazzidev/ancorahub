"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

import { LIGHT_TABS, type LightTabId } from "./light-routes";
import { formatQueueBadge, LIGHT_TAB_ICONS } from "./light-tab-icons";

const itemBase =
  "relative inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full transition-[background-color,color,padding] duration-(--duration-fast) ease-(--ease-standard) motion-reduce:transition-none";
const itemIdle = "size-11 text-(--text-secondary) active:bg-(--surface-muted)";
const itemActive = "bg-(--foreground) px-4 text-sm font-semibold text-(--surface)";

/**
 * Floating pill tab bar (mobile only). The active tab is a black pill with icon
 * and label; the others are icon-only with an aria-label. The Fila tab carries
 * a red count badge. "Mais" opens the bottom sheet instead of navigating.
 */
export function LightBottomNav({
  activeTab,
  queueBadgeCount,
  moreOpen,
  onOpenMore,
}: {
  activeTab: LightTabId;
  queueBadgeCount: number;
  moreOpen: boolean;
  onOpenMore: () => void;
}) {
  const MoreIcon = LIGHT_TAB_ICONS.mais;
  const moreActive = activeTab === "mais" || moreOpen;

  return (
    <nav
      aria-label="Navegação principal"
      className="arc-venancor fixed inset-x-4 bottom-[calc(22px+var(--mobile-safe-bottom))] z-40 md:hidden"
    >
      <ul className="mx-auto flex max-w-sm items-center justify-between rounded-full bg-(--surface)/86 p-2 shadow-(--shadow-floating) backdrop-blur-xl backdrop-saturate-150">
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
                {isActive ? <span>{tab.label}</span> : null}
                {badge ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-(--danger) px-1 text-xs font-semibold leading-none tabular-nums text-(--surface)"
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
            {moreActive ? <span>Mais</span> : null}
          </button>
        </li>
      </ul>
    </nav>
  );
}
