"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { UserPlus } from "@/components/huge-icons";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTeamUserAction } from "@/app/(dashboard)/equipe/actions";

type Audience = "manager" | "supervisor";

export function TeamInviteLiteSheet(props: {
  audience: Audience;
  branchId: string;
  branchName: string | null;
  unassignedBrokers?: Array<{ userId: string; name: string }>;
}) {
  const [role, setRole] = useState<"broker" | "supervisor">("broker");
  const [selectedBrokerIds, setSelectedBrokerIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [activationUrl, setActivationUrl] = useState("");
  const router = useRouter();
  const reducedMotion = useReducedMotion() ?? false;
  const inviteRole = props.audience === "manager" ? role : "broker";
  const candidates = props.unassignedBrokers ?? [];

  function submit(formData: FormData) {
    setMessage("");
    setActivationUrl("");
    formData.set("role", inviteRole);
    formData.set("jobTitle", inviteRole);
    formData.set("branchId", props.branchId);
    formData.set("supervisedBrokerIds", JSON.stringify(inviteRole === "supervisor" ? selectedBrokerIds : []));
    startTransition(async () => {
      const result = await createTeamUserAction({}, formData);
      if (!result.success) {
        setMessage(result.error ?? "Não foi possível criar o convite.");
        return;
      }
      setMessage("Convite criado. Compartilhe o link de primeiro acesso com a pessoa.");
      if (result.token) setActivationUrl(`${window.location.origin}/onboarding?token=${result.token}`);
      router.refresh();
    });
  }

  return (
    <BottomSheet
      className="arc-venancor"
      trigger={<Button><UserPlus weight="bold" /><span>Adicionar pessoa</span></Button>}
      title={props.audience === "manager" ? "Adicionar à unidade" : "Convidar corretor"}
      description={props.audience === "manager" ? "O convite fica vinculado à sua unidade." : "O corretor entra na sua equipe ao aceitar."}
      closeLabel="Fechar"
      detents={[0.58, 0.9]}
    >
      <form action={submit} className="grid gap-3 px-1 pb-8">
        {props.audience === "manager" ? (
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Papel</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["broker", "supervisor"] as const).map((value) => (
                <Button key={value} type="button" variant={inviteRole === value ? "default" : "outline"} aria-pressed={inviteRole === value} onClick={() => setRole(value)}>
                  {value === "broker" ? "Corretor" : "Supervisor"}
                </Button>
              ))}
            </div>
          </fieldset>
        ) : null}
        <label className="grid gap-1.5 text-sm font-medium">Nome<Input name="name" required minLength={2} maxLength={120} disabled={pending} autoComplete="name" /></label>
        <label className="grid gap-1.5 text-sm font-medium">E-mail <span className="font-normal text-muted-foreground">(opcional)</span><Input name="email" type="email" maxLength={254} disabled={pending} autoComplete="email" /></label>
        <label className="grid gap-1.5 text-sm font-medium">Telefone<Input name="phone" type="tel" required minLength={8} maxLength={30} disabled={pending} autoComplete="tel" placeholder="(21) 99999-9999" /></label>
        <div className="rounded-2xl bg-muted/70 px-3 py-2 text-sm text-muted-foreground">
          Unidade: <strong className="font-medium text-foreground">{props.branchName ?? "Unidade da sua conta"}</strong>
        </div>
        {props.audience === "manager" && inviteRole === "supervisor" ? (
          <fieldset className="grid gap-2 rounded-2xl bg-muted/50 p-3">
            <legend className="px-1 text-sm font-medium">Corretores livres para acompanhar (opcional)</legend>
            {candidates.length ? candidates.map((broker) => (
              <label key={broker.userId} className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={selectedBrokerIds.includes(broker.userId)}
                  disabled={pending}
                  onChange={(event) => setSelectedBrokerIds((current) => event.target.checked ? [...current, broker.userId] : current.filter((id) => id !== broker.userId))}
                />
                <span>{broker.name}</span>
              </label>
            )) : <p className="m-0 text-xs text-muted-foreground">Não há corretores livres nesta unidade. Você pode convidar o supervisor sem equipe inicial.</p>}
          </fieldset>
        ) : null}
        {message ? <motion.p role="status" aria-live="polite" className="m-0 text-sm text-muted-foreground" initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.2 }}>{message}</motion.p> : null}
        {activationUrl ? (
          <div className="grid gap-2 rounded-2xl bg-muted/70 p-3">
            <a href={activationUrl} className="break-all text-sm text-primary underline">Abrir link de primeiro acesso</a>
            <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(activationUrl)}>Copiar link</Button>
          </div>
        ) : null}
        <Button type="submit" disabled={pending}>{pending ? "Criando convite..." : "Criar convite"}</Button>
      </form>
    </BottomSheet>
  );
}
