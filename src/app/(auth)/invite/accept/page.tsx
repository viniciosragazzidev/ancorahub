"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { acceptInviteAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const token = params?.get("token") ?? "";
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    toast.info("Ativando seu acesso...");
    const result = await acceptInviteAction(new FormData(event.currentTarget));
    if (result.error) { toast.error(result.error); setPending(false); return; }
    toast.success("Acesso ativado. Você já pode entrar.");
    window.setTimeout(() => router.replace("/login"), 500);
  }
  return <div className="space-y-6"><div className="space-y-2 text-center"><p className="text-xs font-medium text-primary">CONVITE CORRETOP</p><h1 className="text-2xl font-semibold">Defina sua senha</h1><p className="text-sm text-muted-foreground">Use uma senha com pelo menos 8 caracteres para ativar seu acesso.</p></div><form onSubmit={submit} className="space-y-4"><input name="token" type="hidden" value={token} /><div className="space-y-2"><Label htmlFor="invite-password">Senha</Label><Input id="invite-password" minLength={8} name="password" required type="password" /></div><Button className="w-full" disabled={pending} type="submit">{pending ? "Ativando..." : "Ativar acesso"}</Button></form></div>;
}
