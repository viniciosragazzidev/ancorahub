"use client";

/**
 * "Segurança" no visual Lite: autenticação em duas etapas e chaves de acesso. Mesmas chamadas do authClient, mesma
 * auditoria (recordSecurityAuditAction) e mesmas mensagens da aba atual. Excluir chave pede confirmação Lite no
 * lugar do confirm do navegador. A largura do aparelho (celular força biometria do aparelho) é lida depois da
 * hidratação, como hoje.
 *
 * Feedback (FEEDBACK.md, nível 1): ativar, desativar, gerar códigos, cadastrar, renomear e excluir biometria
 * mostram o envio no botão e confirmam na própria seção depois do servidor; a falha mostra a causa e
 * "Tentar de novo". Copiar é nível 0: o botão vira "Copiado" por um instante.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Fingerprint, KeyRound, Pencil, ShieldCheck, Trash2 } from "lucide-react";

import { LiteConfirmDialog, LiteSelect } from "@/components/lite/controls";
import { formatLiteDate } from "@/components/lite/format/date";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { authClient } from "@/shared/auth/client";

import { recordSecurityAuditAction } from "../../security-actions";
import styles from "@/components/lite/page/lite-sections.module.css";

import { ActionNote, BusyLabel, useActionStatus } from "./action-status-lite";

function getSecretFromUri(uri: string | null) {
  if (!uri) return null;
  try { return new URL(uri).searchParams.get("secret"); } catch { return null; }
}

/** Copiar (nível 0): o botão mostra "Copiado" por 1,6 s; se a área de transferência recusar, diz isso no lugar. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1600);
  }
  return (
    <button type="button" className={page.button} onClick={() => void copy()}>
      <Copy aria-hidden="true" size={16} />
      <span role="status">{state === "copied" ? "Copiado" : state === "failed" ? "Não deu para copiar" : label}</span>
    </button>
  );
}

export function SecurityLite({ enabled: initialEnabled, email }: { enabled: boolean; email: string }) {
  return (
    <>
      <TwoFactorLite initialEnabled={initialEnabled} email={email} />
      <PasskeysLite />
    </>
  );
}

function TwoFactorLite({ initialEnabled, email }: { initialEnabled: boolean; email: string }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const { status, run } = useActionStatus();
  const [action, setAction] = useState<"enable" | "disable" | "codes" | null>(null);
  const busy = status.twoFactor?.state === "busy";

  function enable() {
    setAction("enable");
    void run("twoFactor", async () => {
      const result = await authClient.twoFactor.enable({ password: password || undefined, issuer: "Âncora Corretora" });
      if (result.error || !result.data) throw new Error(result.error?.message ?? "Não foi possível ativar o 2FA.");
      setEnabled(true);
      if (result.data.method === "totp") {
        setTotpUri(result.data.totpURI);
        setBackupCodes(result.data.backupCodes);
      }
      setPassword("");
      await recordSecurityAuditAction("ativou_2fa");
    }, { done: "2FA ativado. Guarde seus códigos de recuperação.", fallback: "Não foi possível ativar o 2FA.", keeps: "A conta continua sem duas etapas." });
  }

  function disable() {
    setAction("disable");
    void run("twoFactor", async () => {
      const result = await authClient.twoFactor.disable({ password: password || undefined });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível desativar o 2FA.");
      setEnabled(false); setTotpUri(null); setBackupCodes([]); setPassword("");
      await recordSecurityAuditAction("desativou_2fa");
    }, { done: "2FA desativado para esta conta.", fallback: "Não foi possível desativar o 2FA.", keeps: "As duas etapas continuam ativas." });
  }

  function regenerateCodes() {
    setAction("codes");
    void run("twoFactor", async () => {
      const result = await authClient.twoFactor.generateBackupCodes({ password: password || undefined });
      if (result.error || !result.data) throw new Error(result.error?.message ?? "Não foi possível gerar novos códigos.");
      setBackupCodes(result.data.backupCodes); setPassword("");
      await recordSecurityAuditAction("gerou_codigos_backup");
    }, { done: "Novos códigos gerados. Os anteriores foram invalidados.", fallback: "Não foi possível gerar novos códigos.", keeps: "Os códigos anteriores continuam valendo." });
  }

  const secret = getSecretFromUri(totpUri);

  return (
    <section className={styles.group} aria-labelledby="two-factor-title">
      <div className={styles.row}>
        <div className={styles.rowText}>
          <h3 id="two-factor-title" className={styles.rowTitle}>Autenticação em duas etapas</h3>
          <p className={styles.rowDescription}>Proteja o acesso de {email} com um aplicativo autenticador.</p>
        </div>
        <span className={page.badge} data-tone={enabled ? "success" : undefined}>{enabled ? "Ativo" : "Não configurado"}</span>
      </div>
      {status.twoFactor && !busy ? <div className={styles.formBody}><ActionNote status={status.twoFactor} /></div> : null}
      {!enabled ? (
        <div className={styles.formBody}>
          <ol className={styles.steps}>
            <li>Ative o recurso com sua senha atual.</li>
            <li>Cadastre a chave em Authenticator, 1Password ou similar.</li>
            <li>Guarde os códigos de recuperação em local seguro.</li>
          </ol>
          <label className={form.field} style={{ maxWidth: 360 }}>
            <span className={form.label}>Senha atual</span>
            <input className={form.input} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha para continuar" />
          </label>
          <div>
            <button type="button" className={page.primaryButton} onClick={enable} disabled={busy || !password} aria-busy={busy || undefined}>
              <BusyLabel busy={busy} label="Ativando…">
                <ShieldCheck aria-hidden="true" size={16} />
                Ativar duas etapas
              </BusyLabel>
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.formBody}>
          <div className={styles.notice} data-tone="success">
            <p className={styles.noticeTitle} data-tone="success">Sua conta está protegida.</p>
            <p className={styles.note}>O código será solicitado em novos acessos quando necessário.</p>
          </div>
          {totpUri || backupCodes.length ? (
            <div className={styles.notice}>
              <p className={styles.noticeTitle}>Configuração concluída</p>
              <p className={styles.note}>Use a chave abaixo caso o aplicativo não permita ler um QR code.</p>
              {secret ? (
                <div className={styles.badges}>
                  <code className={styles.code}>{secret}</code>
                  <CopyButton value={secret} label="Copiar chave" />
                </div>
              ) : null}
              {backupCodes.length ? (
                <>
                  <div className={styles.footer} style={{ padding: 0 }}>
                    <p className={styles.rowTitle}>Códigos de recuperação</p>
                    <CopyButton value={backupCodes.join("\n")} label="Copiar todos" />
                  </div>
                  <ul className={styles.codes}>{backupCodes.map((code) => <li key={code}>{code}</li>)}</ul>
                  <p className={styles.note}>Cada código pode ser usado uma única vez. Não os compartilhe.</p>
                </>
              ) : null}
            </div>
          ) : null}
          <label className={form.field} style={{ maxWidth: 360 }}>
            <span className={form.label}>Confirme sua senha para alterar</span>
            <input className={form.input} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <div className={styles.badges}>
            <button type="button" className={page.button} disabled={busy || !password} aria-busy={(busy && action === "codes") || undefined} onClick={regenerateCodes}>
              <BusyLabel busy={busy && action === "codes"} label="Gerando…"><KeyRound aria-hidden="true" size={16} /> Gerar novos códigos</BusyLabel>
            </button>
            <button type="button" className={page.button} data-tone="danger" disabled={busy || !password} aria-busy={(busy && action === "disable") || undefined} onClick={disable}>
              <BusyLabel busy={busy && action === "disable"} label="Desativando…">Desativar 2FA</BusyLabel>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

type Passkey = { id: string; name: string | null; deviceType: string; backedUp: boolean; createdAt: string };

const DEVICE_LABELS: Record<string, string> = { platform: "Biometria (Face ID ou digital)", "cross-platform": "Chave de segurança USB" };
const ATTACHMENT_OPTIONS = [
  { value: "platform", label: "Biometria ou aparelho local (recomendado)" },
  { value: "cross-platform", label: "Chave de segurança USB (YubiKey ou externa)" },
];

function PasskeysLite() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const { status, run } = useActionStatus();
  const [busy, setBusy] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [attachmentType, setAttachmentType] = useState<"platform" | "cross-platform">("platform");
  const [removing, setRemoving] = useState<{ id: string; label: string } | null>(null);
  const cancelRemove = useCallback(() => setRemoving(null), []);

  const refresh = useCallback(async () => {
    const result = await authClient.passkey.listUserPasskeys();
    if (result.data) setPasskeys(result.data as unknown as Passkey[]);
  }, []);

  useEffect(() => {
    void refresh();
    const checkMobile = () => setIsMobile(window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [refresh]);

  async function passkeyAction(key: string, task: () => Promise<void>, options: { done: string; fallback: string; keeps: string }) {
    setBusy(key);
    const done = await run("passkeys", async () => { await task(); return true; }, options);
    setBusy("");
    return done !== undefined;
  }

  async function addPasskey() {
    await passkeyAction("add", async () => {
      const finalName = name.trim() || (isMobile ? "Biometria Celular" : "Biometria do Dispositivo");
      const result = await authClient.passkey.addPasskey({ name: finalName, authenticatorAttachment: isMobile ? "platform" : attachmentType || "platform" });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível cadastrar a biometria.");
      await recordSecurityAuditAction("cadastrou_passkey");
      setName("");
      await refresh();
    }, { done: "Biometria cadastrada", fallback: "Não foi possível cadastrar a biometria.", keeps: "As biometrias que você já tem continuam valendo." });
  }

  async function renamePasskey() {
    if (!editingId || !editingName.trim()) return;
    const id = editingId;
    const nextName = editingName.trim();
    const ok = await passkeyAction("rename", async () => {
      const result = await authClient.passkey.updatePasskey({ id, name: nextName });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível renomear.");
      await recordSecurityAuditAction("renomeou_passkey");
      await refresh();
    }, { done: "Nome atualizado", fallback: "Não foi possível renomear.", keeps: "O nome anterior continua." });
    if (ok) {
      setEditingId(null);
      setEditingName("");
    }
  }

  async function deletePasskey(id: string, label: string) {
    await passkeyAction(id, async () => {
      const result = await authClient.passkey.deletePasskey({ id });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível excluir.");
      await recordSecurityAuditAction("excluiu_passkey");
      await refresh();
    }, { done: `Biometria "${label}" removida`, fallback: "Não foi possível excluir.", keeps: "A biometria continua cadastrada." });
  }

  return (
    <section id="passkey-section" className={styles.group} aria-labelledby="passkey-title">
      <div className={styles.row}>
        <div className={styles.rowText}>
          <h3 id="passkey-title" className={styles.rowTitle}>Chaves de acesso</h3>
          <p className={styles.rowDescription}>Use a digital ou o reconhecimento facial do aparelho para entrar com um toque, sem digitar senha.</p>
        </div>
        <button type="button" className={page.primaryButton} onClick={addPasskey} disabled={busy === "add"} aria-busy={busy === "add" || undefined}>
          <BusyLabel busy={busy === "add"} label="Aguardando leitura…">
            <Fingerprint aria-hidden="true" size={16} />
            Cadastrar biometria
          </BusyLabel>
        </button>
      </div>
      {busy === "add" ? (
        <div className={styles.formBody}>
          <p className={styles.note} role="status">Siga as instruções na tela do seu aparelho para confirmar a leitura do Face ID ou da digital.</p>
        </div>
      ) : null}
      {!isMobile ? (
        <div className={styles.formBody}>
          <div>
            <button type="button" className={page.button} aria-expanded={showAdvanced} onClick={() => setShowAdvanced((value) => !value)}>
              {showAdvanced ? "Ocultar opções avançadas" : "Opções avançadas"}
            </button>
          </div>
          {showAdvanced ? (
            <div className={styles.fields}>
              <label className={form.field}>
                <span className={form.label}>Nome personalizado (opcional)</span>
                <input className={form.input} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: meu iPhone" />
              </label>
              <LiteSelect label="Tipo de autenticador" value={attachmentType} options={ATTACHMENT_OPTIONS} onChange={(value) => setAttachmentType(value as "platform" | "cross-platform")} />
            </div>
          ) : null}
        </div>
      ) : null}
      <div>
        <p className={styles.item}><span className={styles.rowTitle}>Biometrias cadastradas ({passkeys.length})</span></p>
        {status.passkeys && !busy ? <div className={styles.formBody}><ActionNote status={status.passkeys} /></div> : null}
        {passkeys.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Nenhuma biometria cadastrada ainda</p>
            <p>Use &quot;Cadastrar biometria&quot; para guardar a digital ou o Face ID deste aparelho.</p>
          </div>
        ) : (
          <ul className={styles.list} aria-label="Biometrias cadastradas">
            {passkeys.map((passkey) => {
              const label = passkey.name || "Biometria cadastrada";
              const editing = editingId === passkey.id;
              return (
                <li key={passkey.id} className={styles.item}>
                  {editing ? (
                    <div className={styles.badges}>
                      <input
                        className={form.input}
                        style={{ width: 220 }}
                        aria-label="Novo nome da biometria"
                        value={editingName}
                        autoFocus
                        onChange={(event) => setEditingName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void renamePasskey();
                          if (event.key === "Escape") { setEditingId(null); setEditingName(""); }
                        }}
                      />
                      <button type="button" className={page.primaryButton} onClick={renamePasskey} disabled={busy === "rename"} aria-busy={busy === "rename" || undefined}><BusyLabel busy={busy === "rename"} label="Salvando…">Salvar nome</BusyLabel></button>
                      <button type="button" className={page.button} onClick={() => { setEditingId(null); setEditingName(""); }}>Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <span className={styles.itemText}>
                        <span className={styles.itemTitle}>{label}</span>
                        <span className={styles.itemSub}>
                          {DEVICE_LABELS[passkey.deviceType] ?? passkey.deviceType}
                          {passkey.backedUp ? " · Sincronizada" : ""}
                          {" · Criada em "}
                          {formatLiteDate(passkey.createdAt, { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </span>
                      <span className={styles.actions}>
                        <button type="button" className={page.iconButton} aria-label={`Renomear ${label}`} onClick={() => { setEditingId(passkey.id); setEditingName(passkey.name || ""); }}>
                          <Pencil aria-hidden="true" size={18} />
                        </button>
                        <button type="button" className={page.iconButton} aria-label={`Excluir ${label}`} disabled={busy === passkey.id} aria-busy={busy === passkey.id || undefined} onClick={() => setRemoving({ id: passkey.id, label })}>
                          <Trash2 aria-hidden="true" size={18} />
                        </button>
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <LiteConfirmDialog
        open={Boolean(removing)}
        title="Remover esta biometria?"
        description={removing ? `"${removing.label}" deixa de entrar na sua conta.` : undefined}
        confirmLabel="Remover biometria"
        tone="danger"
        onCancel={cancelRemove}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) void deletePasskey(target.id, target.label);
        }}
      />
    </section>
  );
}
