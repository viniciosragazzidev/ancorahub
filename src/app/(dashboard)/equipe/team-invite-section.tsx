"use client";

import { useRef, useState, useTransition } from "react";
import { UserPlus, WhatsappLogo } from "@/components/huge-icons";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogPopup, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTeamUserAction, importBrokersAction } from "./actions";

type Props = { branches: { id: string; name: string }[]; canInviteManager: boolean; canInviteDirector?: boolean };

const jobTitles = [
  { value: "director", label: "Diretor" },
  { value: "manager", label: "Gestor" },
  { value: "broker", label: "Corretor" },
  { value: "marketing", label: "Marketing" },
  { value: "finance", label: "Financeiro" },
  { value: "operations", label: "Operações" },
  { value: "support", label: "Suporte" },
] as const;

export function TeamInviteSection({ branches, canInviteManager, canInviteDirector }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<"queued" | "not_available" | "failed" | "sent" | null>(null);
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual');
  const [jobTitle, setJobTitle] = useState("broker");
  const [role, setRole] = useState(canInviteDirector ? "director" : canInviteManager ? "manager" : "broker");
  const formRef = useRef<HTMLFormElement>(null);
  const csvFormRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "");
    startTransition(async () => {
      const result = await createTeamUserAction({ success: false }, formData);
      if (result.success) {
        toast.success("Perfil profissional criado com sucesso.");
        setWhatsappStatus(result.whatsappStatus ?? "not_available");
        setCreatedName(name);
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        if (result.token) {
          setCreatedLink(`${origin}/onboarding?token=${result.token}`);
        } else {
          formRef.current?.reset();
          setOpen(false);
        }
        router.refresh();
      } else {
        toast.error("Não foi possível criar o acesso", { description: result.error });
      }
    });
  }

  function handleImportSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await importBrokersAction({ success: false }, formData);
      if (result.success) {
        toast.success("Importação concluída.", { description: result.report || "" });
        csvFormRef.current?.reset();
        setOpen(false);
        router.refresh();
      } else {
        toast.error("Não foi possível importar", { description: result.error });
      }
    });
  }

  function handleClose() {
    setOpen(false);
    setCreatedLink(null);
    setActiveTab('manual');
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger render={<Button><UserPlus weight="bold" /> Novo Funcionário</Button>} />
      <DialogPopup className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        {createdLink ? (
          <div className="space-y-4 pt-2">
            <DialogTitle>Convite Criado!</DialogTitle>
            <DialogDescription>
              O perfil profissional foi criado com sucesso. Como não utilizamos senhas padrões, envie o link de ativação exclusivo abaixo para o colaborador:
            </DialogDescription>
            <div className={`rounded-lg border p-3 text-sm ${whatsappStatus === "queued" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              {whatsappStatus === "sent" ? "Convite enviado pelo WhatsApp corporativo." : whatsappStatus === "queued" ? "Convite enfileirado para envio pelo WhatsApp corporativo." : "Envie a mensagem de convite manualmente abaixo."}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mensagem pronta para WhatsApp:</label>
              <div className="rounded-lg border border-border bg-muted/60 p-3 text-xs whitespace-pre-wrap select-all font-sans leading-relaxed text-foreground">
                {`Olá${createdName ? `, ${createdName}` : ""}! Seja bem-vindo(a) à nossa equipe. 🚀\n\nPara concluir o seu cadastro e ativar o seu acesso ao CRM, acesse o seu link de ativação exclusivo abaixo:\n\n👉 ${createdLink}\n\nSe precisar de ajuda com o seu primeiro acesso, estou à disposição!`}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                className="w-full gap-2"
                onClick={async () => {
                  const msg = `Olá${createdName ? `, ${createdName}` : ""}! Seja bem-vindo(a) à nossa equipe. 🚀\n\nPara concluir o seu cadastro e ativar o seu acesso ao CRM, acesse o seu link de ativação exclusivo abaixo:\n\n👉 ${createdLink}\n\nSe precisar de ajuda com o seu primeiro acesso, estou à disposição!`;
                  await navigator.clipboard.writeText(msg);
                  toast.success("Mensagem completa de convite copiada!");
                }}
              >
                <WhatsappLogo className="size-4 text-emerald-500" /> Copiar Mensagem Pronta (WhatsApp)
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2 text-xs"
                  onClick={async () => {
                    await navigator.clipboard.writeText(createdLink);
                    toast.success("Link direto copiado!");
                  }}
                >
                  Copiar Apenas Link
                </Button>

                <Button
                  variant="secondary"
                  className="flex-1 gap-2 text-xs"
                  onClick={() => {
                    const msg = `Olá${createdName ? `, ${createdName}` : ""}! Seja bem-vindo(a) à nossa equipe. 🚀\n\nPara concluir o seu cadastro e ativar o seu acesso ao CRM, acesse o seu link de ativação exclusivo abaixo:\n\n👉 ${createdLink}\n\nSe precisar de ajuda com o seu primeiro acesso, estou à disposição!`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
                  }}
                >
                  <WhatsappLogo className="size-4" /> Abrir no WhatsApp
                </Button>
              </div>

              <Button variant="ghost" className="mt-1" onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <DialogTitle>Novo Funcionário</DialogTitle>
            <DialogDescription>Escolha o cadastro manual ou a importação em lote por CSV.</DialogDescription>

            <div className="flex rounded-lg bg-muted p-1 text-xs">
              <button
                className={`flex-1 rounded-md py-1.5 font-medium transition-all ${activeTab === 'manual' ? 'bg-background shadow-sm text-foreground font-semibold' : 'text-muted-foreground'
                  }`}
                onClick={() => setActiveTab('manual')}
                type="button"
              >
                Cadastro Manual
              </button>
              <button
                className={`flex-1 rounded-md py-1.5 font-medium transition-all ${activeTab === 'csv' ? 'bg-background shadow-sm text-foreground font-semibold' : 'text-muted-foreground'
                  }`}
                onClick={() => setActiveTab('csv')}
                type="button"
              >
                Importação CSV
              </button>
            </div>

            {activeTab === 'manual' ? (
              <form ref={formRef} action={handleSubmit} className="grid gap-4">
                <Field><FieldLabel htmlFor="user-name">Nome</FieldLabel><Input id="user-name" name="name" required disabled={pending} /></Field>
                <Field><FieldLabel htmlFor="user-email">E-mail</FieldLabel><Input id="user-email" name="email" type="email" required disabled={pending} /></Field>
                <Field><FieldLabel htmlFor="user-phone">Telefone</FieldLabel><Input id="user-phone" name="phone" placeholder="(21) 99999-9999" required disabled={pending} /></Field>
                <Field><FieldLabel htmlFor="user-cpf">CPF <span className="text-muted-foreground">(opcional)</span></FieldLabel><Input id="user-cpf" name="cpf" placeholder="000.000.000-00" disabled={pending} /></Field>
                <Field>
                  <FieldLabel>Cargo</FieldLabel>
                  <Select name="jobTitle" value={jobTitle} onValueChange={(val) => {
                    if (!val) return;
                    setJobTitle(val);
                    if (val === "director") setRole("director");
                    else if (val === "manager") setRole("manager");
                    else setRole("broker");
                  }} disabled={pending} labels={Object.fromEntries(jobTitles.map((t) => [t.value, t.label]))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                    <SelectContent>
                      {jobTitles
                        .filter((item) => (item.value === "director" ? canInviteDirector : canInviteManager || item.value !== "manager"))
                        .map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Perfil de acesso</FieldLabel>
                  <Select name="role" value={role} onValueChange={(val) => {
                    if (!val) return;
                    setRole(val);
                    if (val === "director") setJobTitle("director");
                    else if (val === "manager") setJobTitle("manager");
                  }} disabled={pending || jobTitle === "broker" || jobTitle === "manager" || jobTitle === "director"} labels={{ director: "Acesso Global (Direção)", manager: "Gestão da unidade", broker: "Operação individual" }}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecione o perfil" /></SelectTrigger>
                    <SelectContent>
                      {canInviteDirector ? <SelectItem value="director">Acesso Global (Direção)</SelectItem> : null}
                      {canInviteManager && jobTitle !== "broker" && jobTitle !== "director" ? <SelectItem value="manager">Gestão da unidade</SelectItem> : null}
                      {jobTitle !== "manager" && jobTitle !== "director" ? <SelectItem value="broker">Operação individual</SelectItem> : null}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Unidade</FieldLabel>
                  <Select name="branchId" required disabled={pending}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                    <SelectContent>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <div className="sticky bottom-0 -mx-1 border-t border-border bg-card px-1 pt-3">
                  <Button className="w-full" type="submit" disabled={pending}>{pending ? "Criando acesso..." : "Criar acesso"}</Button>
                </div>
              </form>
            ) : (
              <form ref={csvFormRef} action={handleImportSubmit} className="grid gap-4">
                <Field>
                  <FieldLabel htmlFor="csv-file">Arquivo CSV (.csv)</FieldLabel>
                  <Input id="csv-file" name="file" type="file" accept=".csv" required disabled={pending} />
                </Field>
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1.5">
                  <p className="font-semibold text-foreground">Instruções para o CSV:</p>
                  <p>1. O cabeçalho deve conter: <strong>nome, email, telefone, cpf</strong>.</p>
                  <p>2. Adicionalmente, pode conter a coluna opcional <strong>unidade</strong> (nome ou ID da filial).</p>
                  <p>3. Os corretores importados serão criados como Rascunho (DRAFT) na unidade correspondente.</p>
                </div>
                <div className="sticky bottom-0 -mx-1 border-t border-border bg-card px-1 pt-3">
                  <Button className="w-full" type="submit" disabled={pending}>{pending ? "Importando..." : "Importar Corretores"}</Button>
                </div>
              </form>
            )}
            <DialogClose render={<Button variant="ghost" className="w-full" disabled={pending}>Cancelar</Button>} />
          </div>
        )}
      </DialogPopup>
    </Dialog>
  );
}
