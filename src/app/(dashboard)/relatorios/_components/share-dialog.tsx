"use client";

import { useActionState, useState, useEffect } from "react";
import {  Copy, Eye, EyeSlash, LinkSimple } from "@/components/huge-icons";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generatePublicLinkAction } from "./spreadsheet-actions";

export function ShareDialog({
  spreadsheetId,
  existingToken,
  onShared,
}: {
  spreadsheetId: string;
  existingToken: string | null;
  onShared: () => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState(generatePublicLinkAction, {});

  useEffect(() => {
    if (state.success && state.publicToken) {
      toast.success("Link público gerado!");
      onShared();
    }
    if (state.error) {
      toast.error(state.error);
    }
  }, [state.success, state.error, state.publicToken, onShared]);

  const publicUrl = existingToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/compartilhado/${existingToken}`
    : null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <LinkSimple className="size-4 text-primary" />
        <p className="text-sm font-medium">Compartilhar visualização</p>
      </div>

      {publicUrl ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={publicUrl}
              readOnly
              className="h-8 text-xs"
              onClick={(e) => e.currentTarget.select()}
            />
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 h-8"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                toast.success("Link copiado!");
              }}
            >
              <Copy className="size-3.5" />
              Copiar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {existingToken && "Com senha definida."} Compartilhe este link para visualizar os dados publicamente.
          </p>
        </div>
      ) : (
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={spreadsheetId} />
          <div className="space-y-1.5">
            <Label htmlFor="share-password" className="text-xs">
              Senha de proteção (opcional)
            </Label>
            <div className="relative">
              <Input
                id="share-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Deixe em branco para acesso livre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-8 pr-8 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeSlash className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Se definida, o visitante precisará da senha para acessar.
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Gerando..." : "Gerar link público"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
