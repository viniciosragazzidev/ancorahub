"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createExtensionCodeAction } from "@/features/browser-extension/actions";

export function ExtensionConnectCard() {
  const [code, setCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return <div className="space-y-2"><Button type="button" variant="outline" disabled={isPending} onClick={() => startTransition(async () => { const result = await createExtensionCodeAction(); setCode(result.code); })}>{isPending ? "Gerando…" : "Gerar código de conexão"}</Button>{code ? <div className="rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm" role="status">{code}<p className="mt-1 font-sans text-xs text-muted-foreground">Copie para a extensão. Expira em 5 minutos.</p></div> : null}</div>;
}
