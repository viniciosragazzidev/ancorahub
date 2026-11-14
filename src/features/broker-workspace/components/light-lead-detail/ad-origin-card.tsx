"use client";

import { Play, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import type { BrokerAdContext } from "@/features/leads/broker-ad-context";

const ENTRY_LABEL: Record<BrokerAdContext["entry"], string> = {
  form: "Formulário do anúncio",
  whatsapp: "WhatsApp do anúncio",
};

/** Texto do anúncio a partir do qual vale oferecer "Ver texto completo". */
const LONG_BODY = 140;

/**
 * "De onde veio" (10/11/2026): o plano que a campanha anuncia e o que o cliente
 * viu no anúncio, para o corretor não oferecer um plano mais caro do que o
 * anunciado. Nunca o nome da campanha, IDs ou verba (ver broker-ad-context.ts).
 */
export function AdOriginCard({ ad }: { ad: BrokerAdContext | null | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  if (!ad) return null;

  const image = ad.imageUrl && !imageFailed ? ad.imageUrl : null;
  const longBody = Boolean(ad.body && ad.body.length > LONG_BODY);
  const hasCreative = Boolean(ad.title || ad.body || image);
  const imageAlt = ad.title ? `Anúncio: ${ad.title}` : "Imagem do anúncio";

  return (
    <section aria-labelledby={`${id}-heading`} data-tour="micro-lead-ad-origin" className="arc-venancor rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={`${id}-heading`} className="text-sm font-medium text-(--foreground)">De onde veio</h2>
        <span className="text-xs text-(--text-muted)">{ENTRY_LABEL[ad.entry]}</span>
      </div>

      {ad.offer ? (
        <div className="mt-3">
          <p className="text-xs text-(--text-muted)">Plano anunciado</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm font-medium text-(--foreground) [overflow-wrap:anywhere]">{ad.offer}</p>
        </div>
      ) : null}

      {hasCreative ? (
        <div className={ad.offer ? "mt-3 border-t border-(--border-subtle) pt-3" : "mt-3"}>
          <p className="text-xs text-(--text-muted)">O que o cliente viu</p>
          <div className="mt-2 flex min-w-0 gap-3">
            {image ? (
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                aria-label="Ampliar imagem do anúncio"
                className="relative size-14 shrink-0 cursor-zoom-in overflow-hidden rounded-2xl bg-(--surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--foreground)"
              >
                {/* URL da Meta (criativo público); next/image não conhece o domínio. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt={imageAlt}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setImageFailed(true)}
                  className="size-full object-cover"
                />
                {ad.mediaType === "video" ? (
                  <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
                    <span className="flex size-6 items-center justify-center rounded-full bg-(--surface)/90 text-(--foreground)">
                      <Play className="size-3 translate-x-px fill-current" />
                    </span>
                  </span>
                ) : null}
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              {ad.title ? <p className="break-words text-sm font-medium text-(--foreground) [overflow-wrap:anywhere]">{ad.title}</p> : null}
              {ad.body ? (
                <p
                  id={`${id}-body`}
                  className={`mt-0.5 whitespace-pre-line break-words text-sm leading-relaxed text-(--text-secondary) [overflow-wrap:anywhere] ${expanded || !longBody ? "" : "line-clamp-2"}`}
                >
                  {ad.body}
                </p>
              ) : null}
            </div>
          </div>
          {longBody ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-controls={`${id}-body`}
              className="mt-1 -ml-1 min-h-11 rounded-full px-1 text-sm font-medium text-(--text-secondary) hover:text-(--foreground)"
            >
              {expanded ? "Ver menos" : "Ver texto completo"}
            </button>
          ) : null}
        </div>
      ) : null}

      {fullscreen && image && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={imageAlt}
              className="fixed inset-0 z-[1100] flex cursor-zoom-out items-center justify-center bg-black/85 p-4"
              onClick={() => setFullscreen(false)}
            >
              <button
                type="button"
                aria-label="Fechar imagem"
                autoFocus
                onClick={() => setFullscreen(false)}
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <X className="size-5" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={imageAlt}
                referrerPolicy="no-referrer"
                className="max-h-[90vh] max-w-full rounded-2xl object-contain"
              />
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
