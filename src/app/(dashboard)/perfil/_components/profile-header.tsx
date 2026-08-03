"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MemberStatusBadge, RoleBadge } from "@/components/status-badges";
import { AvailabilityToggle } from "@/app/(dashboard)/corretor/resumo/_components/availability-toggle";
import { formatDate } from "@/features/quotes/utils";
import { updateAvatarAction, type ProfileActionState } from "../actions";
import type { PerfilData } from "../perfil-tabs";

const roleLabel: Record<string, string> = {
  director: "Diretor",
  manager: "Gestor",
  broker: "Corretor",
};

function AvatarUpload({
  initialImage,
  name,
}: {
  initialImage: string | null;
  name: string;
}) {
  const [preview, setPreview] = useState(initialImage);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState<ProfileActionState, FormData>(
    async (prev, formData) => {
      const result = await updateAvatarAction(prev, formData);
      if (result.success) toast.success("Foto de perfil atualizada.");
      else toast.error(result.error ?? "Erro ao salvar a foto.");
      return result;
    },
    {},
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Escolha um arquivo PNG, JPG ou WebP.");
      return;
    }
    if (file.size > 512 * 1024) {
      setError("A foto deve ter no máximo 512 KB.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      if (hiddenInputRef.current) hiddenInputRef.current.value = dataUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleClear = useCallback(() => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (hiddenInputRef.current) hiddenInputRef.current.value = "";
  }, []);

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <form action={formAction} className="flex items-center gap-4">
      <input ref={hiddenInputRef} name="avatar" type="hidden" value={preview ?? ""} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleChange}
      />
      <div className="relative shrink-0">
        <Avatar size="lg" className="size-20 rounded-2xl">
          {preview ? (
            <AvatarImage src={preview} alt={name} className="rounded-2xl" />
          ) : null}
          <AvatarFallback className="rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Alterar foto"
          className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <HugeiconsIcon icon={Camera01Icon} size={15} />
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        <Button type="submit" size="sm" variant="outline" disabled={isPending || !preview}>
          {isPending ? "Salvando..." : "Salvar foto"}
        </Button>
        {preview ? (
          <Button type="button" size="sm" variant="ghost" onClick={handleClear}>
            Remover
          </Button>
        ) : null}
        {error || state.error ? (
          <p className="text-xs text-destructive" role="alert">{error ?? state.error}</p>
        ) : null}
      </div>
    </form>
  );
}

export function ProfileHeader({ data }: { data: PerfilData }) {
  const user = data.user;
  const membership = data.membership;
  const broker = data.brokerProfile;
  if (!user || !membership) return null;

  const roleName = membership.customRoleName ?? roleLabel[membership.role] ?? membership.role;
  const displayName = broker?.professionalName ?? user.name;
  const isBroker = membership.role === "broker";

  return (
    <Card className="border-border bg-card shadow-none">
      <CardContent className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <AvatarUpload initialImage={user.image} name={displayName} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight">{displayName}</h1>
                <MemberStatusBadge status={membership.status === "active" ? "active" : "inactive"} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <RoleBadge role={membership.role} />
                <span>{roleName}</span>
                <span className="text-border">•</span>
                <span>{membership.branchName ?? "Geral da empresa"}</span>
              </div>
              <p className="mt-2 truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            {isBroker ? <AvailabilityToggle initialStatus={membership.availabilityStatus as "available" | "paused" | "offline"} /> : null}
            <Badge variant="outline" className="text-xs font-medium">
              No sistema desde {formatDate(user.createdAt, { day: "numeric", month: "short", year: "numeric" })}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 border-t border-border/60 pt-4 text-xs">
          {broker?.internalCode ? (
            <div>
              <p className="text-muted-foreground">Código interno</p>
              <p className="mt-0.5 font-mono font-medium text-foreground">{broker.internalCode}</p>
            </div>
          ) : null}
          <div>
            <p className="text-muted-foreground">E-mail verificado</p>
            <p className="mt-0.5 font-medium text-foreground">{user.emailVerified ? "Sim" : "Não"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Autenticação em duas etapas</p>
            <p className="mt-0.5 font-medium text-foreground">{user.twoFactorEnabled ? "Ativada" : "Não configurada"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
