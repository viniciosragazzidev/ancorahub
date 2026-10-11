"use client";

import { useState } from "react";

import { ActionButton } from "@/components/arc/action-button/action-button";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Textarea } from "@/components/arc/textarea/textarea";
import type { JourneyActionResponse, JourneyRecognitionReceipt, RecognizeBrokerInput } from "@/features/journey/director-types";

import styles from "./recognize-sheet.module.css";

const AMOUNTS = [5, 10, 20, 30, 50] as const;
const SUGGESTIONS = ["Atendimento caprichado", "Respondeu rápido o dia todo", "Virou um lead difícil", "Ajudou a equipe"];
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * "Reconhecer com pontos" (plan §1, C4): the supervisor picks 5 to 50 points
 * and says why; the broker gets a celebration and the points in the ledger.
 * The weekly cap is the server's (the receipt says what is left).
 */
export function RecognizeSheet({ brokerId, brokerName, open, onOpenChange, onRecognize }: {
  brokerId: string;
  brokerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecognize: (input: RecognizeBrokerInput) => Promise<JourneyActionResponse<JourneyRecognitionReceipt>>;
}) {
  const [points, setPoints] = useState<number>(10);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<JourneyRecognitionReceipt | null>(null);
  const name = firstName(brokerName);

  async function send() {
    setError(null);
    if (reason.trim().length < 3) { setError("Diga o motivo em poucas palavras."); throw new Error("reason"); }
    const result = await onRecognize({ brokerId, points, reason: reason.trim() });
    if (!result.ok) { setError(result.message); throw new Error(result.message); }
    setReceipt(result.data);
  }

  function close(value: boolean) {
    onOpenChange(value);
    if (!value) { setReceipt(null); setReason(""); setError(null); setPoints(10); }
  }

  return (
    <BottomSheet className="arc-venancor" open={open} onOpenChange={close} title={receipt ? `Reconhecimento enviado para ${name}` : `Reconhecer ${name}`} description={receipt ? undefined : "Os pontos entram na jornada, com uma comemoração."} detents={[0.72, 0.94]} closeLabel="Fechar">
      {receipt ? (
        <div className={styles.done}>
          <span className={styles.doneBadge} aria-hidden="true">+{receipt.points}</span>
          <p>{name} vai ver a comemoração na próxima vez que abrir o app.</p>
          <small>Você ainda pode dar {receipt.remainingWeeklyPoints} pts de reconhecimento nesta semana.</small>
          <button type="button" className={styles.close} onClick={() => close(false)}>Fechar</button>
        </div>
      ) : (
        <div className={styles.form}>
          <fieldset className={styles.amounts}>
            <legend>Quantos pontos</legend>
            <div role="radiogroup" aria-label="Quantos pontos" className={styles.amountRow}>
              {AMOUNTS.map((amount) => (
                <button key={amount} type="button" role="radio" aria-checked={points === amount} className={styles.amount} onClick={() => setPoints(amount)}>+{amount}</button>
              ))}
            </div>
          </fieldset>
          <div className={styles.reason}>
            <Textarea label="Por quê" id="recognize-reason" value={reason} maxLength={200} rows={3} placeholder={`O que ${name} fez de bom?`} onChange={(event) => setReason(event.currentTarget.value)} />
            <div className={styles.suggestions} aria-label="Sugestões">
              {SUGGESTIONS.map((text) => <button key={text} type="button" className={styles.suggestion} onClick={() => setReason(text)}>{text}</button>)}
            </div>
          </div>
          <div className={styles.preview} aria-label="Como o corretor vê">
            <span className={styles.previewPoints}>+{points}</span>
            <span><strong>Reconhecimento</strong><small>{reason.trim() || "O motivo aparece aqui."}</small></span>
          </div>
          {error ? <p role="alert" className={styles.error}>{error}</p> : null}
          <ActionButton label={`Dar ${points} pts para ${name}`} pendingLabel="Enviando" successLabel="Reconhecido" onAction={send} onActionError={() => undefined} />
        </div>
      )}
    </BottomSheet>
  );
}
