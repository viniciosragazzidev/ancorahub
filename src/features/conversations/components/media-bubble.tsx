"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  FileArrowDown as Download,
  File,
  FileText,
  ImageIcon,
  Music,
  Play,
  PauseCircle,
  Video,
  WarningCircle,
} from "@/components/huge-icons";
import { isMediaKindSupported } from "../media-kinds";

export { isMediaKindSupported } from "../media-kinds";

export type MediaBubbleData = {
  kind: string;
  mimeType: string | null;
  filename: string | null;
  sizeBytes: number | null;
  /** Authenticated route that streams the binary from private storage. */
  url: string;
  caption?: string | null;
};

export function formatMediaSize(sizeBytes: number | null | undefined) {
  if (!sizeBytes || sizeBytes <= 0) return "";
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Renders one media message inside a chat bubble. Viewing (image/video) and
 * listening (audio) happen inline; every byte flows through the authenticated
 * tenant-scoped route, never a public bucket URL (DEC-098).
 */
export function MediaBubble({
  media,
  isOutbound,
  onOpenFullscreen,
}: {
  media: MediaBubbleData;
  isOutbound: boolean;
  onOpenFullscreen?: (media: MediaBubbleData) => void;
}) {
  const kind = media.kind;

  if (kind === "image") {
    return (
      <MediaImage media={media} isOutbound={isOutbound} onOpenFullscreen={onOpenFullscreen} />
    );
  }
  if (kind === "audio") {
    return <MediaAudio media={media} isOutbound={isOutbound} />;
  }
  if (kind === "video") {
    return <MediaVideo media={media} isOutbound={isOutbound} onOpenFullscreen={onOpenFullscreen} />;
  }
  if (kind === "document") {
    return <MediaDocument media={media} isOutbound={isOutbound} />;
  }
  return null;
}

function MediaImage({
  media,
  isOutbound,
  onOpenFullscreen,
}: {
  media: MediaBubbleData;
  isOutbound: boolean;
  onOpenFullscreen?: (media: MediaBubbleData) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) return <MediaUnavailable isOutbound={isOutbound} />;

  return (
    <figure className="flex max-w-72 flex-col gap-1">
      <button
        type="button"
        aria-label="Abrir imagem em tela cheia"
        className={cn(
          "group/media relative overflow-hidden rounded-xl border border-border/50 bg-muted/40 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          !loaded && "min-h-40 min-w-56 animate-pulse",
        )}
        onClick={() => onOpenFullscreen?.(media)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated streaming route with no-store; next/image has no benefit for one-off blobs */}
        <img
          src={media.url}
          alt={media.caption || media.filename || "Imagem recebida"}
          loading="lazy"
          className="max-h-64 w-full cursor-zoom-in object-cover"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      </button>
      {media.caption ? (
        <figcaption className={cn("text-xs leading-5", isOutbound ? "text-primary-foreground/90" : "text-foreground/90")}>
          {media.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function MediaAudio({ media, isOutbound }: { media: MediaBubbleData; isOutbound: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setPlaying(false);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play().catch(() => setFailed(true));
    }
  }

  if (failed) return <MediaUnavailable isOutbound={isOutbound} />;

  return (
    <div className="flex w-60 flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={playing ? "Pausar áudio" : "Ouvir áudio"}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            isOutbound ? "bg-primary-foreground/15 hover:bg-primary-foreground/25" : "bg-primary/10 hover:bg-primary/20",
          )}
        >
          {playing ? <PauseCircle className="size-4" /> : <Play className="size-4" />}
        </button>
        <div className="flex-1">
          <audio
            ref={audioRef}
            src={media.url}
            preload="none"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setFailed(true)}
            className="hidden"
          />
          <div
            aria-hidden="true"
            className="flex h-6 items-center gap-0.5"
          >
            {Array.from({ length: 22 }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  "w-0.5 rounded-full",
                  isOutbound ? "bg-primary-foreground/50" : "bg-muted-foreground/50",
                  index % 4 === 0 ? "h-5" : index % 3 === 0 ? "h-3" : "h-4",
                )}
              />
            ))}
          </div>
        </div>
      </div>
      <MediaMetaLine media={media} isOutbound={isOutbound} />
    </div>
  );
}

function MediaVideo({
  media,
  isOutbound,
  onOpenFullscreen,
}: {
  media: MediaBubbleData;
  isOutbound: boolean;
  onOpenFullscreen?: (media: MediaBubbleData) => void;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) return <MediaUnavailable isOutbound={isOutbound} />;

  return (
    <figure className="flex max-w-72 flex-col gap-1">
      <video
        src={media.url}
        controls
        preload="metadata"
        controlsList="nodownload"
        onError={() => setFailed(true)}
        onDoubleClick={() => onOpenFullscreen?.(media)}
        className="max-h-64 w-full rounded-xl border border-border/50 bg-black/80"
        aria-label={media.caption || media.filename || "Vídeo recebido"}
      />
      {media.caption ? (
        <figcaption className={cn("text-xs leading-5", isOutbound ? "text-primary-foreground/90" : "text-foreground/90")}>
          {media.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function MediaDocument({ media, isOutbound }: { media: MediaBubbleData; isOutbound: boolean }) {
  return (
    <a
      href={media.url}
      download={media.filename ?? undefined}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex w-64 items-center gap-3 rounded-xl p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        isOutbound ? "bg-primary-foreground/10 hover:bg-primary-foreground/20" : "bg-muted/60 hover:bg-muted",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          isOutbound ? "bg-primary-foreground/15" : "bg-primary/10",
        )}
      >
        <File className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">
          {media.filename || "Documento"}
        </span>
        <span className={cn("block text-[10px]", isOutbound ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {formatMediaSize(media.sizeBytes) || "Arquivo anexado"}
        </span>
      </span>
      <Download className={cn("size-4 shrink-0", isOutbound ? "text-primary-foreground/80" : "text-muted-foreground")} />
    </a>
  );
}

function MediaMetaLine({ media, isOutbound }: { media: MediaBubbleData; isOutbound: boolean }) {
  return (
    <span className={cn("text-[10px]", isOutbound ? "text-primary-foreground/70" : "text-muted-foreground")}>
      {media.filename || "Áudio"} {formatMediaSize(media.sizeBytes) ? `• ${formatMediaSize(media.sizeBytes)}` : ""}
    </span>
  );
}

export function MediaUnavailable({ isOutbound }: { isOutbound: boolean }) {
  return (
    <div
      role="status"
      className={cn(
        "flex w-60 items-center gap-2 rounded-xl p-2.5 text-xs",
        isOutbound ? "bg-primary-foreground/10" : "bg-muted/60",
      )}
    >
      <WarningCircle className={cn("size-4 shrink-0", isOutbound ? "text-primary-foreground/80" : "text-warning")} />
      <span>
        Mídia indisponível
        <span className={cn("block text-[10px]", isOutbound ? "text-primary-foreground/70" : "text-muted-foreground")}>
          O arquivo não pôde ser recuperado. O conteúdo original permanece no WhatsApp.
        </span>
      </span>
    </div>
  );
}

/** Keeps icon imports referenced for tree-shaking stability in dev builds. */
export const MEDIA_KIND_ICONS = {
  image: ImageIcon,
  audio: Music,
  video: Video,
  document: FileText,
} as const;
