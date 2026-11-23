"use client";

import { useEffect, useId, useState } from "react";

import { Switch } from "@/components/arc/switch/switch";
import { LiteActionButton, type LiteActionOutcome } from "@/components/lite/controls/action-button";
import { LiteSelect } from "@/components/lite/controls/select";
import { playVoice } from "@/lib/feedback/voice-playback";

import { loadSasaVoice, setSasaVoiceState, stopSasaVoice, useSasaVoice } from "../client";
import { charsLeftToday, isElderlyMaleVoice, orderVoices, SASA_VOICE_MAX_CHARS_PER_REPLY, type SasaVoiceOption } from "../rules";
import styles from "./sasa-voice.module.css";

/**
 * Voz da Sasá (teste de 23/11, só o Vinicios): conectar a key do ElevenLabs, escolher a voz, testar e desligar.
 * A key é digitada aqui e vai direto para o servidor, que a guarda criptografada; a tela só volta a ver os 4 últimos
 * caracteres. Feedback nível 1 pelo LiteActionButton: sucesso só depois do servidor, erro com a causa e o que vale.
 */
export function SasaVoiceSettings() {
  const voice = useSasaVoice({ load: true });
  const backend = voice.backend;
  const state = voice.state;
  const keyId = useId();
  const hintId = useId();
  const [apiKey, setApiKey] = useState("");
  const [changing, setChanging] = useState(false);
  const [voices, setVoices] = useState<SasaVoiceOption[]>([]);
  const [round, setRound] = useState(0);

  // Conectado: a lista de vozes vem da conta dele.
  useEffect(() => {
    if (!state?.connected || voices.length) return;
    let alive = true;
    void backend.voices().then((result) => { if (alive && result.ok) setVoices(result.voices); });
    return () => { alive = false; };
  }, [backend, state?.connected, voices.length]);

  if (!state) return <section className={`arc-venancor ${styles.card}`} aria-busy="true"><p className={styles.sub}>Carregando…</p></section>;
  if (!state.allowed) return <section className={`arc-venancor ${styles.card}`}><p className={styles.sub}>A voz da Sasá ainda não está liberada para você.</p></section>;

  const askingKey = !state.connected || changing;
  const typed = apiKey.trim();

  async function connect(): Promise<LiteActionOutcome> {
    const result = await backend.connect(typed);
    if (!result.ok) return { ok: false, message: result.error };
    setSasaVoiceState(result.state);
    setVoices(result.voices);
    setApiKey("");
    setChanging(false);
    setRound((value) => value + 1);
    return { ok: true };
  }

  async function test(): Promise<LiteActionOutcome> {
    stopSasaVoice();
    const speech = await backend.speak({ test: true });
    if (!speech.ok) return { ok: false, message: `Não consegui testar: ${speech.reason}.` };
    const played = await playVoice(speech.audio);
    if (!played) return { ok: false, message: "O áudio chegou, mas não tocou. Confira se o som do app está ligado." };
    return { ok: true };
  }

  async function disconnect(): Promise<LiteActionOutcome> {
    stopSasaVoice();
    const result = await backend.disconnect();
    if (!result.ok) return { ok: false, message: result.error };
    setSasaVoiceState(result.state);
    setVoices([]);
    setRound((value) => value + 1);
    return { ok: true };
  }

  const left = charsLeftToday(state.usedToday, state.dailyLimit);
  // Padrão pedido em 23/11: um senhor idoso. Sem nenhum na conta, a tela avisa e ele escolhe.
  const ordered = orderVoices(voices, state.voiceId);
  const noElderly = voices.length > 0 && !voices.some(isElderlyMaleVoice);
  const voiceLabel = (item: SasaVoiceOption) => {
    const details = [isElderlyMaleVoice(item) ? "senhor idoso" : null, item.language].filter(Boolean);
    return details.length ? `${item.name} (${details.join(", ")})` : item.name;
  };

  return (
    <div className="arc-venancor flex flex-col gap-4">
      <section aria-labelledby="voice-key-heading" className={styles.card}>
        <div>
          <h2 id="voice-key-heading" className={styles.title}>Conta do ElevenLabs</h2>
          <p className={styles.sub}>
            {state.connected
              ? <>Conectada com a key terminada em <span className={styles.numbers}>{state.keyLast4}</span>.</>
              : "Cole a API key da sua conta do ElevenLabs. Ela fica guardada criptografada no servidor e não aparece de novo."}
          </p>
        </div>

        {askingKey ? (
          <>
            <div className={styles.field}>
              <label htmlFor={keyId} className={styles.label}>API key</label>
              <input
                id={keyId}
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk_..."
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                aria-describedby={hintId}
                className={styles.input}
              />
              <p id={hintId} className={styles.hint}>No ElevenLabs: perfil, API Keys. Precisa da permissão de voz e de texto para fala.</p>
            </div>
            <div className={styles.row}>
              <LiteActionButton key={`connect-${round}`} busyLabel="Conectando…" doneLabel="Conectada" keeps={state.connected ? "A key anterior continua valendo." : undefined} errorFallback="Não consegui conectar agora." disabled={typed.length < 20} tone={state.connected ? "secondary" : "primary"} onAction={connect}>
                {state.connected ? "Salvar key nova" : "Conectar"}
              </LiteActionButton>
              {changing ? <button type="button" className={styles.secondary} onClick={() => { setChanging(false); setApiKey(""); }}>Cancelar</button> : null}
            </div>
          </>
        ) : (
          <div className={styles.row}>
            <button type="button" className={styles.secondary} onClick={() => setChanging(true)}>Trocar key</button>
            <LiteActionButton key={`disconnect-${round}`} busyLabel="Desconectando…" doneLabel="Desconectada" keeps="A key continua guardada." errorFallback="Não consegui desconectar agora." onAction={disconnect} tone="secondary">
              Desconectar
            </LiteActionButton>
          </div>
        )}
      </section>

      {state.connected ? (
        <section aria-labelledby="voice-reply-heading" className={styles.card}>
          <div className={styles.switchRow}>
            <div>
              <h2 id="voice-reply-heading" className={styles.title}>Sasá responde por voz</h2>
              <p className={styles.sub}>O texto continua aparecendo. Segurar o botão para falar corta a voz.</p>
            </div>
            <Switch
              aria-label="Sasá responde por voz"
              checked={state.enabled}
              onCheckedChange={(enabled) => { void voice.toggle(enabled); }}
            />
          </div>

          <LiteSelect
            label="Voz"
            value={state.voiceId ?? ""}
            placeholder={voices.length ? "Escolha uma voz" : "Carregando vozes…"}
            options={ordered.map((item) => ({ value: item.id, label: voiceLabel(item) }))}
            onChange={async (voiceId) => {
              const picked = voices.find((item) => item.id === voiceId);
              if (!picked) return;
              const result = await backend.choose({ voiceId: picked.id, voiceName: picked.name });
              if (result.ok) setSasaVoiceState(result.state);
              else void loadSasaVoice(backend, true);
            }}
          />

          {noElderly ? (
            <p className={styles.hint} role="status">Não achei uma voz de senhor idoso na sua conta do ElevenLabs. Escolha uma na lista ou adicione uma pela biblioteca de vozes do ElevenLabs.</p>
          ) : null}

          <div className={styles.row}>
            <LiteActionButton key={`test-${round}-${state.voiceId}`} busyLabel="Gerando a voz…" doneLabel="Voz testada" errorFallback="Não consegui testar a voz." onAction={test}>
              Testar voz
            </LiteActionButton>
          </div>
          <p className={styles.hint}>
            Até {SASA_VOICE_MAX_CHARS_PER_REPLY} caracteres por resposta. Hoje ainda cabem <span className={styles.numbers}>{left.toLocaleString("pt-BR")}</span> de <span className={styles.numbers}>{state.dailyLimit.toLocaleString("pt-BR")}</span>.
          </p>
        </section>
      ) : null}
    </div>
  );
}
