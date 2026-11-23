"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { LiteActionButton, type LiteActionOutcome } from "@/components/lite/controls/action-button";
import { changeOwnPhoneAction, type ChangeOwnPhoneState } from "@/features/broker-phone-change/actions";
import { formatBrazilMobile, isSameMobile, maskBrazilMobileInput, parseBrazilMobile } from "@/features/broker-phone-change/phone-rules";
import { useDevLab } from "@/lib/dev-lab";

type Props = {
  /** O número gravado no perfil, como está no banco. */
  currentPhone: string | null;
  changeAction?: (phone: string) => Promise<ChangeOwnPhoneState>;
};

/**
 * Configurações > Meu telefone do corretor (23/11/2026). Um campo e uma ação: o corretor digita o celular
 * novo e troca. O servidor valida, recusa número de outra pessoa da empresa e registra a troca para o diretor.
 * Feedback nível 1 (FEEDBACK.md) pelo LiteActionButton: "Trocando…" enquanto o servidor responde, check só
 * depois da confirmação, som de confirmação (troca é rara); erro com a causa, o número atual continua e
 * "Tentar de novo". Nenhuma mensagem é enviada ao número novo.
 */
export function LightPhoneSection({ currentPhone, changeAction }: Props) {
  const router = useRouter();
  const lab = useDevLab();
  const change = changeAction ?? lab?.phoneChange ?? changeOwnPhoneAction;
  const fieldId = useId();
  const hintId = useId();
  const [current, setCurrent] = useState(currentPhone);
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  // Depois de um sucesso o botão fica em "Telefone trocado"; digitar de novo traz um botão novo.
  const [round, setRound] = useState(0);
  const [justChanged, setJustChanged] = useState(false);

  const parsed = parseBrazilMobile(value);
  const same = parsed.ok && isSameMobile(current, parsed.national);
  const complete = value.replace(/\D/g, "").length >= 11;
  const hint = !value
    ? "Com DDD. É por ele que chegam os avisos de lead, de plantão e a recuperação de senha."
    : same ? "Esse já é o seu número."
    : !parsed.ok && (complete || touched) ? parsed.error
    : parsed.ok ? `Vai ficar ${formatBrazilMobile(parsed.phone)}.`
    : "Com DDD, como (71) 99999-1234.";
  const invalid = Boolean(value) && (same || (!parsed.ok && (complete || touched)));

  async function save(): Promise<LiteActionOutcome> {
    if (!parsed.ok) return { ok: false, message: parsed.error };
    const response = await change(parsed.phone);
    if (!response.ok) return { ok: false, message: response.error };
    setCurrent(response.phone);
    setValue("");
    setTouched(false);
    setJustChanged(true);
    router.refresh();
    return { ok: true };
  }

  function onChange(next: string) {
    setValue(maskBrazilMobileInput(next));
    if (justChanged) {
      setJustChanged(false);
      setRound((count) => count + 1);
    }
  }

  return (
    <section aria-labelledby="phone-heading" className="arc-venancor flex flex-col gap-4 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <div>
        <h2 id="phone-heading" className="text-base font-medium text-(--foreground)">Seu telefone</h2>
        <p className="mt-1 text-sm text-(--text-secondary)">
          {current
            ? <>Hoje é <span className="font-medium tabular-nums text-(--foreground)">{formatBrazilMobile(current)}</span>.</>
            : "Você ainda não tem celular no cadastro."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium text-(--foreground)">Novo celular</label>
        <input
          id={fieldId}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(71) 99999-1234"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setTouched(Boolean(value))}
          aria-invalid={invalid || undefined}
          aria-describedby={hintId}
          className="min-h-11 w-full rounded-full border border-(--border) bg-(--background) px-4 text-base tabular-nums text-(--foreground) outline-none transition-colors placeholder:text-(--text-muted) focus-visible:border-(--accent) aria-invalid:border-(--danger) md:text-sm"
        />
        <p id={hintId} className={`text-xs leading-5 ${invalid ? "text-(--danger)" : "text-(--text-secondary)"}`} aria-live="polite">{hint}</p>
      </div>

      <LiteActionButton
        key={round}
        className="self-start"
        busyLabel="Trocando…"
        doneLabel="Telefone trocado"
        confirmSound
        keeps={current ? `Seu número continua ${formatBrazilMobile(current)}.` : undefined}
        errorFallback="Não consegui trocar seu telefone agora."
        disabled={!parsed.ok || same}
        onAction={save}
      >
        Trocar telefone
      </LiteActionButton>
    </section>
  );
}
