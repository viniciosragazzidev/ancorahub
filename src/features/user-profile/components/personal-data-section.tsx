"use client";

import { useActionState, useCallback, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Camera01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateAvatarAction, updateDisplayNameAction, type ProfileActionState } from "../actions";
import type { PerfilData } from "./perfil-tabs";

function AvatarUpload({ initialImage, name }: { initialImage: string | null; name: string }) {
  const [preview, setPreview] = useState(initialImage);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, isPending] = useActionState<ProfileActionState, FormData>(
    async (previousState, formData) => {
      const result = await updateAvatarAction(previousState, formData);
      if (result.success) toast.success("Foto de perfil atualizada.");
      else toast.error(result.error ?? "Erro ao salvar a foto.");
      return result;
    },
    {},
  );

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Escolha uma imagem PNG, JPG ou WebP.");
      return;
    }
    if (file.size > 512 * 1024) {
      setError("A foto deve ter no máximo 512 KB.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const image = reader.result as string;
      setPreview(image);
      if (hiddenInputRef.current) hiddenInputRef.current.value = image;
    };
    reader.readAsDataURL(file);
  }, []);

  const initials = name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input ref={hiddenInputRef} name="avatar" type="hidden" value={preview ?? ""} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleChange}
      />
      <Avatar size="lg" className="size-16 rounded-xl border border-border bg-card">
        {preview ? <AvatarImage src={preview} alt={name} className="rounded-xl" /> : null}
        <AvatarFallback className="rounded-xl bg-primary/10 font-semibold text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <HugeiconsIcon icon={Camera01Icon} size={16} />
          Escolher foto
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">PNG, JPG ou WebP com até 512 KB.</p>
        {error || state.error ? (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error ?? state.error}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={isPending || !preview} className="sm:ml-auto">
        {isPending ? "Salvando..." : "Salvar foto"}
      </Button>
    </form>
  );
}

export function PersonalDataSection({ data }: { data: PerfilData }) {
  const [state, formAction, isPending] = useActionState<ProfileActionState, FormData>(
    async (previousState, formData) => {
      const result = await updateDisplayNameAction(previousState, formData);
      if (result.success) toast.success("Nome atualizado com sucesso.");
      else toast.error(result.error ?? "Não foi possível salvar o nome.");
      return result;
    },
    {},
  );

  const broker = data.brokerProfile;

  return (
    <Card variant="overview" className="bg-card/80 shadow-2xs">
      <CardHeader className="border-b border-border/60 px-5 py-4 sm:px-6">
        <CardTitle>Perfil pessoal</CardTitle>
        <CardDescription>
          Atualize como você aparece para sua equipe. Dados de acesso e vínculo são administrados
          pela corretora.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border/60 px-5 sm:px-6">
        <form
          action={formAction}
          className="grid gap-4 py-5 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8"
        >
          <div>
            <h2 className="text-sm font-semibold text-foreground">Informações pessoais</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Seu nome e e-mail de acesso.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="name">Nome completo</FieldLabel>
              <Input
                id="name"
                name="name"
                defaultValue={data.user?.name ?? ""}
                maxLength={80}
                disabled={isPending}
                aria-describedby={state.error ? "name-error" : undefined}
              />
              {state.error ? <FieldError id="name-error">{state.error}</FieldError> : null}
              <FieldDescription>Exibido no cabeçalho e nas listas internas.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input id="email" readOnly value={data.user?.email ?? ""} />
              <FieldDescription>Usado para entrar na conta.</FieldDescription>
            </Field>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </form>

        <section
          className="grid gap-4 py-5 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8"
          aria-labelledby="professional-access-title"
        >
          <div>
            <h2 id="professional-access-title" className="text-sm font-semibold text-foreground">
              Acesso profissional
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Informações definidas pela administração.
            </p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Nome profissional</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {broker?.professionalName ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Telefone</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{broker?.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">CPF</dt>
              <dd className="mt-1 font-mono text-sm font-medium text-foreground">
                {broker?.cpf ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Código interno</dt>
              <dd className="mt-1 font-mono text-sm font-medium text-foreground">
                {broker?.internalCode ?? "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section
          className="grid gap-4 py-5 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8"
          aria-labelledby="profile-photo-title"
        >
          <div>
            <h2 id="profile-photo-title" className="text-sm font-semibold text-foreground">
              Foto de perfil
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Escolha a imagem exibida no seu perfil.
            </p>
          </div>
          <AvatarUpload
            initialImage={data.user?.image ?? null}
            name={data.user?.name ?? "Usuário"}
          />
        </section>
      </CardContent>
    </Card>
  );
}
