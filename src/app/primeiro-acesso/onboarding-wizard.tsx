"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { completeOnboardingAction } from "./onboarding-actions";

type Props = {
  invitation: {
    id: string;
    email: string;
    tenantName: string;
    branchName: string;
  };
  profile: {
    professionalName: string;
    phone: string;
    cpf: string | null;
    internalCode: string;
  };
};

export function OnboardingWizard({ invitation, profile }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(profile.professionalName);
  const [phone, setPhone] = useState(profile.phone);
  const [cpfInput, setCpfInput] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function nextStep() {
    if (step === 1) {
      if (!name.trim() || !phone.trim()) {
        toast.error("Por favor, preencha seu nome e telefone profissional.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const cleanInput = cpfInput.replace(/\D/g, "");
      const cleanProfile = profile.cpf?.replace(/\D/g, "") ?? "";
      if (cleanInput && cleanProfile && cleanInput !== cleanProfile) {
        toast.error("O CPF digitado não coincide com o CPF cadastrado para o perfil.");
        return;
      }
      if (!birthDate.trim()) {
        toast.error("Por favor, informe sua data de nascimento.");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (password.length < 10) {
        toast.error("A senha deve ter no mínimo 10 caracteres.");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("As senhas não coincidem.");
        return;
      }
      setStep(4);
    }
  }

  function prevStep() {
    setStep((prev) => prev - 1);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!termsAccepted) {
      toast.error("Você precisa aceitar os termos de uso para continuar.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("invitationId", invitation.id);
      formData.append("name", name);
      formData.append("phone", phone);
      formData.append("cpf", cpfInput);
      formData.append("birthDate", birthDate);
      formData.append("password", password);
      formData.append("termsAccepted", "on");

      const result = await completeOnboardingAction({ success: false }, formData);
      if (result.success) {
        toast.success("Conta ativada com sucesso! Redirecionando para o login...");
        setTimeout(() => {
          router.push("/login?message=onboarding_completed");
        }, 1500);
      } else {
        toast.error("Erro na ativação", { description: result.error });
      }
    });
  }

  return (
    <Card className="w-full max-w-lg border border-border shadow-md bg-card">
      <CardHeader className="border-b border-border pb-4">
        <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">
          Passo {step} de 4 · Primeiro Acesso
        </span>
        <CardTitle className="mt-1 text-xl font-bold tracking-tight text-foreground">
          {step === 1 && "Confirme seu Perfil Profissional"}
          {step === 2 && "Validação de Identidade (CPF)"}
          {step === 3 && "Defina sua Senha de Acesso"}
          {step === 4 && "Termos e Consentimentos"}
        </CardTitle>
        <CardDescription>
          {step === 1 && `Vínculo com ${invitation.tenantName} · Unidade ${invitation.branchName}`}
          {step === 2 && "Confirme o CPF associado a este convite para validar sua segurança."}
          {step === 3 && "Crie uma senha forte e segura para seus acessos futuros."}
          {step === 4 && "Leia e dê o aceite nas políticas operacionais da plataforma."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="prof-name">Nome Profissional</Label>
                <Input id="prof-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prof-email">E-mail Corporativo</Label>
                <Input id="prof-email" value={invitation.email} disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prof-phone">Telefone</Label>
                <Input id="prof-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(21) 99999-9999" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prof-code">Código de Acesso Interno</Label>
                <Input id="prof-code" value={profile.internalCode} disabled className="bg-muted text-muted-foreground font-mono cursor-not-allowed" />
              </div>
              <Button type="button" className="w-full mt-2" onClick={nextStep}>
                Confirmar Dados
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="user-cpf">Digite seu CPF <span className="text-muted-foreground">(opcional)</span></Label>
                <Input id="user-cpf" value={cpfInput} onChange={(e) => setCpfInput(e.target.value)} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-birth">Data de Nascimento</Label>
                <Input id="user-birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" type="button" className="flex-1" onClick={prevStep}>
                  Voltar
                </Button>
                <Button type="button" className="flex-1" onClick={nextStep}>
                  Validar Dados
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="user-pass">Senha de Acesso</Label>
                <Input id="user-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 10 caracteres" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-pass-confirm">Confirme sua Senha</Label>
                <Input id="user-pass-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a senha" required />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" type="button" className="flex-1" onClick={prevStep}>
                  Voltar
                </Button>
                <Button type="button" className="flex-1" onClick={nextStep}>
                  Confirmar Senha
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground max-h-60 overflow-y-auto space-y-3 leading-relaxed">
                <p className="font-semibold text-foreground text-sm">Termos de Uso e Política de Privacidade do CorreTop</p>
                <p>
                  Ao acessar a plataforma CorreTop, você declara estar ciente de que todos os dados de leads, clientes e cotações pertencem exclusivamente à corretora licenciante. É expressamente vedado o compartilhamento ou extração externa de informações protegidas sem autorização expressa da diretoria.
                </p>
                <p>
                  O CorreTop atua sob a base de controlador e operador em estrita conformidade com as diretrizes da LGPD (Lei Geral de Proteção de Dados). Toda e qualquer operação executada pelo usuário gera registros de auditoria inalteráveis contendo dados de identificação, IP e timestamp.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <input
                  id="user-terms"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 size-4 rounded border-gray-300 text-primary focus:ring-primary"
                  required
                  disabled={pending}
                />
                <Label htmlFor="user-terms" className="text-xs text-muted-foreground leading-normal cursor-pointer select-none">
                  Li e aceito os termos de uso, a política de privacidade e de confidencialidade da plataforma CorreTop.
                </Label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" type="button" className="flex-1" onClick={prevStep} disabled={pending}>
                  Voltar
                </Button>
                <Button type="submit" className="flex-1" disabled={pending}>
                  {pending ? "Ativando conta..." : "Concluir e Ativar"}
                </Button>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
