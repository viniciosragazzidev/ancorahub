"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "next/navigation";

import "@/components/arc/venancor-scope.css";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { Stepper } from "@/components/arc/stepper/stepper";
import { authClient } from "@/shared/auth/client";
import { recordSecurityAuditAction } from "@/app/(dashboard)/settings/security-actions";
import { completeOnboardingAction } from "./onboarding-actions";
import { isOnboardingPasswordLongEnough, ONBOARDING_PASSWORD_MIN_LENGTH } from "@/features/team/onboarding-password-policy";

type Props = {
  invitation: {
    id: string;
    email: string | null;
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

const STEPS = [
  { id: "profile", label: "Perfil" },
  { id: "identity", label: "Identidade" },
  { id: "password", label: "Senha" },
  { id: "terms", label: "Termos" },
  { id: "biometrics", label: "Biometria" },
];

async function platformAuthenticatorAvailable(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !("PublicKeyCredential" in window)) return false;
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Local yyyy-mm-dd of today, used as the newest allowed birth date. */
function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * First access of a broker invited by the manager. It runs without the app chrome, so it brings its
 * own canvas, a stepper and one fixed action bar. Token, activation, auto-login and passkey are the
 * same as before.
 */
export function OnboardingWizard({ invitation, profile }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(profile.professionalName);
  const [email, setEmail] = useState(invitation.email ?? "");
  const [phone, setPhone] = useState(profile.phone);
  const [cpfInput, setCpfInput] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(true);
  const router = useRouter();

  useEffect(() => {
    void platformAuthenticatorAvailable().then(setPasskeySupported);
  }, []);

  function nextStep() {
    if (step === 1) {
      if (!name.trim() || !phone.trim() || !email.trim()) {
        toast.error("Por favor, preencha nome, e-mail e telefone profissional.");
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
      if (!isOnboardingPasswordLongEnough(password)) {
        toast.error(`A senha deve ter no mínimo ${ONBOARDING_PASSWORD_MIN_LENGTH} caracteres.`);
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

  function goToDashboard() {
    router.push("/dashboard");
    router.refresh();
  }

  async function registerPasskey() {
    setPasskeyBusy(true);
    try {
      const result = await authClient.passkey.addPasskey({
        name: "Biometria do primeiro acesso",
        authenticatorAttachment: "platform",
      });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível cadastrar a biometria.");
      await recordSecurityAuditAction("cadastrou_passkey");
      toast.success("Biometria cadastrada! Você já pode entrar com a digital.");
      goToDashboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar a biometria.");
    } finally {
      setPasskeyBusy(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step !== 4) return;
    if (!termsAccepted) {
      toast.error("Você precisa aceitar os termos de uso para continuar.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("invitationId", invitation.id);
      formData.append("email", email);
      formData.append("name", name);
      formData.append("phone", phone);
      formData.append("cpf", cpfInput);
      formData.append("birthDate", birthDate);
      formData.append("password", password);
      formData.append("termsAccepted", "on");

      const result = await completeOnboardingAction({ success: false }, formData);
      if (!result.success) {
        toast.error("Erro na ativação", { description: result.error });
        return;
      }

      // This e-mail already has a login active in another company: its current
      // password stays (the one typed here was not applied).
      if (result.keptExistingPassword) {
        toast.success("Acesso ativado! Este e-mail já tem uma senha.", {
          description: "Entre com a senha que você já usa. Se não lembrar, use Esqueci minha senha.",
          duration: 10000,
        });
        router.push("/login?message=onboarding_completed");
        return;
      }

      // DEC-082: auto-login com a senha recém-definida (ainda em memória).
      // Se falhar, a conta já está ativa e o login manual continua válido.
      try {
        const signIn = await authClient.signIn.email({
          email: result.email ?? email,
          password,
        });
        if (!signIn.error) {
          toast.success("Conta ativada com sucesso! Bem-vindo(a).");
          setStep(5);
          return;
        }
        throw new Error(signIn.error.message);
      } catch {
        toast.success("Conta ativada com sucesso! Faça login para continuar.");
        router.push("/login?message=onboarding_completed");
      }
    });
  }

  const titles: Record<number, string> = {
    1: "Confirme seu perfil profissional",
    2: "Validação de identidade",
    3: "Defina sua senha de acesso",
    4: "Termos e consentimentos",
    5: "Acesso com biometria",
  };
  const descriptions: Record<number, string> = {
    1: `Vínculo com ${invitation.tenantName} · Unidade ${invitation.branchName}`,
    2: "Confirme o CPF associado a este convite para validar sua segurança.",
    3: "Crie uma senha forte e segura para seus acessos futuros.",
    4: "Leia e dê o aceite nas políticas operacionais da plataforma.",
    5: "Cadastre sua digital para entrar sem digitar senha, ou pule esta etapa.",
  };

  return (
    <div className="arc-venancor light-canvas flex min-h-dvh w-full flex-col" style={{ color: "var(--foreground)" }}>
      <form
        id="onboarding-form"
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-[calc(112px+var(--mobile-safe-bottom))] pt-[calc(24px+var(--mobile-safe-top))]"
      >
        <Stepper steps={STEPS} current={step - 1} label="Etapas do primeiro acesso" />

        <header>
          <h1 className="text-2xl font-bold tracking-tight text-(--foreground)">{titles[step]}</h1>
          <p className="mt-1 text-sm text-(--text-secondary)">{descriptions[step]}</p>
        </header>

        <section aria-label={titles[step]} className="flex flex-col gap-4 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
          {step === 1 && (
            <>
              <Input label="Nome profissional" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input
                label="E-mail"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={Boolean(invitation.email)}
                required
                autoComplete="email"
                description={invitation.email ? undefined : "Defina o e-mail que será usado para entrar na plataforma."}
              />
              <Input label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(21) 99999-9999" required />
              <Input label="Código de acesso interno" value={profile.internalCode} disabled readOnly />
            </>
          )}

          {step === 2 && (
            <>
              <Input label="CPF (opcional)" value={cpfInput} onChange={(e) => setCpfInput(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" />
              {/* A native date field: the OS picker jumps to a year in two taps, which a month-by-month calendar cannot. */}
              <Input
                label="Data de nascimento"
                type="date"
                value={birthDate}
                max={todayKey()}
                min="1900-01-01"
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </>
          )}

          {step === 3 && (
            <>
              <PasswordField
                label="Senha de acesso"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`Mínimo ${ONBOARDING_PASSWORD_MIN_LENGTH} caracteres`}
                minLength={ONBOARDING_PASSWORD_MIN_LENGTH}
                maxLength={128}
                required
                autoComplete="new-password"
                messages={{ showPassword: "Mostrar senha", hidePassword: "Ocultar senha" }}
              />
              <PasswordField
                label="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                minLength={ONBOARDING_PASSWORD_MIN_LENGTH}
                maxLength={128}
                required
                autoComplete="new-password"
                messages={{ showPassword: "Mostrar senha", hidePassword: "Ocultar senha" }}
              />
            </>
          )}

          {step === 4 && (
            <>
              <div className="flex max-h-60 flex-col gap-3 overflow-y-auto rounded-2xl bg-(--surface-muted) p-4 text-sm leading-relaxed text-(--text-secondary)">
                <p className="font-semibold text-(--foreground)">Termos de uso e política de privacidade</p>
                <p>
                  Ao acessar esta plataforma, você declara estar ciente de que todos os dados de leads, clientes e cotações pertencem exclusivamente à corretora licenciante. É expressamente vedado o compartilhamento ou extração externa de informações protegidas sem autorização expressa da diretoria.
                </p>
                <p>
                  O sistema atua sob a base de controlador e operador em estrita conformidade com as diretrizes da LGPD (Lei Geral de Proteção de Dados). Toda e qualquer operação executada pelo usuário gera registros de auditoria inalteráveis contendo dados de identificação, IP e timestamp.
                </p>
              </div>
              <label htmlFor="user-terms" className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-(--foreground)">
                <input
                  id="user-terms"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-(--accent)"
                  required
                  disabled={pending}
                />
                <span>Li e aceito os termos de uso, a política de privacidade e de confidencialidade da plataforma.</span>
              </label>
            </>
          )}

          {step === 5 && (
            <p className="text-sm leading-relaxed text-(--text-secondary)">
              {passkeySupported
                ? "Use a biometria do seu dispositivo (digital ou Face ID) para entrar no CorreTop sem digitar senha. Você pode cadastrar ou gerenciar biometrias depois, em Configurações, na seção Segurança."
                : "Este dispositivo não parece oferecer autenticador biométrico. Você pode cadastrar uma biometria depois, em Configurações, na seção Segurança, a partir de um dispositivo compatível."}
            </p>
          )}
        </section>
      </form>

      <nav
        aria-label="Ações do primeiro acesso"
        className="fixed inset-x-4 bottom-[calc(22px+var(--mobile-safe-bottom))] z-40"
      >
        <div className="mx-auto flex max-w-md items-center gap-2 rounded-full bg-(--surface)/86 p-2 shadow-(--shadow-floating) backdrop-blur-xl backdrop-saturate-150">
          {step > 1 && step < 5 ? (
            <Button variant="secondary" onClick={prevStep} disabled={pending}>Voltar</Button>
          ) : null}
          {step === 1 ? <Button className="flex-1" onClick={nextStep}>Confirmar dados</Button> : null}
          {step === 2 ? <Button className="flex-1" onClick={nextStep}>Validar dados</Button> : null}
          {step === 3 ? <Button className="flex-1" onClick={nextStep}>Confirmar senha</Button> : null}
          {step === 4 ? (
            <Button className="flex-1" type="submit" form="onboarding-form" loading={pending} disabled={pending}>
              Concluir e ativar
            </Button>
          ) : null}
          {step === 5 ? (
            <>
              <Button variant="secondary" onClick={goToDashboard} disabled={passkeyBusy}>Fazer depois</Button>
              {passkeySupported ? (
                <Button className="flex-1" loading={passkeyBusy} disabled={passkeyBusy} onClick={() => void registerPasskey()}>
                  Ativar digital agora
                </Button>
              ) : (
                <Button className="flex-1" onClick={goToDashboard}>Ir para o painel</Button>
              )}
            </>
          ) : null}
        </div>
      </nav>
    </div>
  );
}
