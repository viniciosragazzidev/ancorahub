"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  File,
  ImageIcon,
  Microphone,
  Paperclip,
  PaperPlaneTilt,
  Video,
} from "@/components/huge-icons";

const MEDIA_OPTIONS = [
  { kind: "image", label: "Imagem", accept: "image/jpeg,image/png,image/webp", icon: ImageIcon, limit: "5 MB" },
  { kind: "audio", label: "Áudio", accept: "audio/*", icon: Microphone, limit: "16 MB" },
  { kind: "video", label: "Vídeo", accept: "video/mp4,video/3gpp", icon: Video, limit: "16 MB" },
  { kind: "document", label: "Documento", accept: "application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt", icon: File, limit: "16 MB" },
] as const;

type MediaKind = (typeof MEDIA_OPTIONS)[number]["kind"];

export function MediaAttachButton({
  leadId,
  disabled,
  onMediaSent,
}: {
  leadId: string;
  disabled?: boolean;
  onMediaSent?: (message: {
    id: string;
    body: string;
    direction: string;
    sentAt: Date;
    media: { kind: string; mimeType: string; filename: string | null; sizeBytes: number; url: string };
  }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeKindRef = useRef<MediaKind>("image");
  const [selected, setSelected] = useState<{ file: File; kind: MediaKind } | null>(null);
  const [caption, setCaption] = useState("");
  const [isSending, setIsSending] = useState(false);

  function openPicker(kind: MediaKind) {
    activeKindRef.current = kind;
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = MEDIA_OPTIONS.find((option) => option.kind === kind)?.accept ?? "*/*";
    input.value = "";
    input.click();
  }

  function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelected({ file, kind: activeKindRef.current });
    setCaption("");
  }

  async function handleSend() {
    if (!selected || isSending) return;
    setIsSending(true);
    try {
      const { sendLeadMediaAction } = await import("@/features/leads/actions/send-lead-media");
      const formData = new FormData();
      formData.set("kind", selected.kind);
      formData.set("file", selected.file);
      if (caption.trim()) formData.set("caption", caption.trim());

      const result = await sendLeadMediaAction(leadId, formData);
      if (!result.success || !result.message) {
        toast.error(result.error ?? "Não foi possível enviar a mídia.");
        return;
      }
      onMediaSent?.({
        id: result.message.id,
        body: result.message.body,
        direction: result.message.direction,
        sentAt: result.message.sentAt,
        media: result.message.media,
      });
      toast.success("Mídia enviada com sucesso.");
      setSelected(null);
      setCaption("");
    } catch {
      toast.error("Erro inesperado ao enviar a mídia.");
    } finally {
      setIsSending(false);
    }
  }

  const selectedOption = selected ? MEDIA_OPTIONS.find((option) => option.kind === selected.kind) : null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFileChosen}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-10 w-10 shrink-0"
              aria-label="Anexar mídia"
              disabled={disabled || isSending}
            >
              <Paperclip className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-48">
          {MEDIA_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.kind}
              onClick={() => openPicker(option.kind)}
              className="flex cursor-pointer items-center gap-2.5 text-xs"
            >
              <option.icon className="size-4 text-muted-foreground" />
              <span className="flex-1">{option.label}</span>
              <span className="text-[10px] text-muted-foreground">{option.limit}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open && !isSending) setSelected(null); }}>
        <DialogPopup className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar {selectedOption?.label.toLowerCase() ?? "mídia"}</DialogTitle>
            <DialogDescription>
              A mídia é entregue pelo canal oficial Meta e armazenada com acesso restrito.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-2.5">
              {selectedOption ? <selectedOption.icon className="size-4 text-muted-foreground" /> : null}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{selected?.file.name}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {selected ? `${(selected.file.size / (1024 * 1024)).toFixed(2)} MB` : ""}
                </span>
              </span>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="media-caption" className="text-xs font-semibold text-foreground">
                Legenda (opcional)
              </label>
              <Textarea
                id="media-caption"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                rows={2}
                maxLength={1_000}
                placeholder="Adicione uma legenda para a mídia..."
                className="text-xs"
                disabled={isSending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)} disabled={isSending}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSend}
              disabled={isSending || !selected}
              className="gap-1.5 text-xs font-semibold"
            >
              <PaperPlaneTilt className="size-3.5" />
              {isSending ? "Enviando..." : "Enviar mídia"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}
