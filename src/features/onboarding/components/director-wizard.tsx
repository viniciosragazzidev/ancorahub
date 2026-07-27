"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle,
  ChevronRightIcon,
  Compass,
  X,
} from "@/components/huge-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Camera01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Dialog, DialogPopup, DialogClose } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { completeInitialSetup } from "../actions/complete-initial-setup";

type DirectorWizardProps = {
  tenantName: string;
  logoUrl: string | null;
};

const TOTAL_STEPS = 3;

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 ml-auto">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${i < current
            ? "bg-foreground w-1.5"
            : i === current
              ? "bg-foreground w-6"
              : "bg-foreground/10 w-1.5"
            }`}
        />
      ))}
    </div>
  );
}

function LogoUpload({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (
        !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(
          file.type,
        )
      ) {
        toast.error("Escolha um arquivo PNG, JPG, WebP ou SVG.");
        return;
      }
      if (file.size > 512 * 1024) {
        toast.error("O logo deve ter no maximo 512 KB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => onChange(reader.result as string);
      reader.readAsDataURL(file);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [onChange]);

  return (
    <div className="grid gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      {value ? (
        <div className="relative flex aspect-[20/9] w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Logo da empresa"
            className="h-full w-full object-contain p-2"
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-1 top-1 rounded-md bg-background/80 p-1 backdrop-blur-sm hover:bg-background"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex aspect-[20/9] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 transition-colors hover:border-primary/50 hover:bg-muted/40"
        >
          <HugeiconsIcon
            icon={Camera01Icon}
            size={20}
            className="text-muted-foreground"
          />
          <span className="text-xs text-muted-foreground">
            Carregar logo da empresa
          </span>
        </button>
      )}
      <p className="text-xs text-muted-foreground">
        400 x 180 px - PNG, JPG, WebP ou SVG - maximo 512 KB
      </p>
    </div>
  );
}

export function DirectorWizard({
  tenantName,
  logoUrl,
}: DirectorWizardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(tenantName);
  const [logo, setLogo] = useState<string | null>(logoUrl);
  const [pending, startTransition] = useTransition();

  const handleDismiss = useCallback(() => {
    setOpen(false);
  }, []);

  const handleComplete = useCallback(() => {
    startTransition(async () => {
      const result = await completeInitialSetup({
        tenantName: name.trim() || tenantName,
        logoUrl: logo ?? undefined,
      });
      if (result.success) {
        toast.success("Configuracao inicial salva!");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao salvar configuracoes.");
      }
    });
  }, [name, logo, tenantName, router]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        handleDismiss();
      } else {
        setOpen(true);
      }
    },
    [handleDismiss],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 sm:max-w-lg data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:translate-y-3 data-starting-style:translate-y-3 data-ending-style:scale-[0.98] data-starting-style:scale-[0.98]"
      >
        <DialogClose
          aria-label="Fechar wizard"
          className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" weight="bold" />
        </DialogClose>

        {/* Header */}
        <div className="flex items-center gap-2 px-6 pt-6">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            C
          </span>
          <span className="text-sm font-semibold tracking-tight">CorreTop</span>
          <StepDots current={step} total={TOTAL_STEPS} />
        </div>

        {/* Step content */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar overscroll-contain px-5 py-5 sm:px-6">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
                className="space-y-5"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-violet-500">
                    <Compass className="size-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">
                      Configuracao inicial
                    </span>
                  </div>
                  <h1 className="text-xl font-semibold tracking-tight">
                    Bem-vindo ao CorreTop
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Vamos personalizar sua corretora. Primeiro, confirme o nome
                    da sua empresa.
                  </p>
                </div>

                <Field>
                  <FieldLabel>Nome da empresa</FieldLabel>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Sua corretora"
                    autoFocus
                  />
                </Field>

                <Separator />

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                  >
                    Pular etapa
                  </button>
                  <Button
                    onClick={() => setStep(1)}
                    disabled={!name.trim()}
                  >
                    Continuar
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
                className="space-y-5"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-violet-500">
                    <HugeiconsIcon icon={Camera01Icon} className="size-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">
                      Personalizacao
                    </span>
                  </div>
                  <h1 className="text-xl font-semibold tracking-tight">
                    Logo da empresa
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Adicione a logo da sua empresa para personalizar o painel.
                  </p>
                </div>

                <LogoUpload value={logo} onChange={setLogo} />

                <Separator />

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="flex items-center gap-1 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                  >
                    <ChevronRightIcon className="size-3 rotate-180" />
                    Voltar
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDismiss}
                      className="text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                    >
                      Pular
                    </button>
                    <Button onClick={() => setStep(2)}>
                      Continuar
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
                className="space-y-5"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-500">
                    <CheckCircle weight="fill" className="size-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">
                      Tudo pronto
                    </span>
                  </div>
                  <h1 className="text-xl font-semibold tracking-tight">
                    Sua corretora esta personalizada
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Confirme os dados abaixo e comece a usar o sistema.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-4">
                    {logo ? (
                      <div className="flex size-14 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logo}
                          alt="Logo"
                          className="h-full w-full object-contain p-1"
                        />
                      </div>
                    ) : (
                      <span className="grid size-14 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                        C
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {name.trim() || tenantName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {!logo
                          ? "Logo padrao do CorreTop"
                          : "Logo personalizada"}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                  >
                    <ChevronRightIcon className="size-3 rotate-180" />
                    Voltar
                  </button>
                  <Button
                    onClick={handleComplete}
                    disabled={pending}
                    className="bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                  >
                    {pending ? "Salvando..." : "Comecar a usar"}
                    {!pending && <ArrowRight className="size-4" />}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
