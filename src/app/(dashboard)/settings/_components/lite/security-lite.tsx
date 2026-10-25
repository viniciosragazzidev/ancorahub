"use client";

/**
 * "Segurança" no visual Lite: autenticação em duas etapas e chaves de acesso. Mesmas chamadas do authClient, mesma
 * auditoria (recordSecurityAuditAction) e mesmas mensagens da aba atual. Excluir chave pede confirmação Lite no
 * lugar do confirm do navegador. A largura do aparelho (celular força biometria do aparelho) é lida depois da
 * hidratação, como hoje.
 */
import { useCallback, useEffect, useState } from "react";
import { Copy, Fingerprint, KeyRound, Pencil, ShieldCheck, Trash2 } from "lucide-react";

import { LiteConfirmDialog, LiteSelect } from "@/components/lite/controls";
import { formatLiteDate } from "@/components/lite/format/date";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { authClient } from "@/shared/auth/client";

import { recordSecurityAuditAction } from "../../security-actions";
import styles from "@/components/lite/page/lite-sections.module.css";

function getSecretFromUri(uri: string | null) {
  if (!uri) return null;
  try { return new URL(uri).searchParams.get("secret"); } catch { return null; }
}

async function copyText(value: string, label: string) {
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copiado.`);
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
  const [busy, setBusy] = useState(false);

  async function enable() {
    setBusy(true);
    try {
      const result = await authClient.twoFactor.enable({ password: password || undefined, issuer: "Âncora Corretora" });
      if (result.error || !result.data) throw new Error(result.error?.message ?? "Não foi possível ativar o 2FA.");
      setEnabled(true);
      if (result.data.method === "totp") {
        setTotpUri(result.data.totpURI);
        setBackupCodes(result.data.backupCodes);
      }
      setPassword("");
      await recordSecurityAuditAction("ativou_2fa");
      toast.success("2FA ativado. Guarde seus códigos de recuperação.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível ativar o 2FA."); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    try {
      const result = await authClient.twoFactor.disable({ password: password || undefined });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível desativar o 2FA.");
      setEnabled(false); setTotpUri(null); setBackupCodes([]); setPassword("");
      await recordSecurityAuditAction("desativou_2fa");
      toast.success("2FA desativado para esta conta.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível desativar o 2FA."); }
    finally { setBusy(false); }
  }

  async function regenerateCodes() {
    setBusy(true);
    try {
      const result = await authClient.twoFactor.generateBackupCodes({ password: password || undefined });
      if (result.error || !result.data) throw new Error(result.error?.message ?? "Não foi possível gerar novos códigos.");
      setBackupCodes(result.data.backupCodes); setPassword("");
      await recordSecurityAuditAction("gerou_codigos_backup");
      toast.success("Novos códigos gerados. Os anteriores foram invalidados.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível gerar novos códigos."); }
    finally { setBusy(false); }
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
            <button type="button" className={page.primaryButton} onClick={enable} disabled={busy || !password}>
              <ShieldCheck aria-hidden="true" size={16} />
              {busy ? "Ativando..." : "Ativar duas etapas"}
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
                  <button type="button" className={page.button} onClick={() => copyText(secret, "Chave")}><Copy aria-hidden="true" size={16} /> Copiar chave</button>
                </div>
              ) : null}
              {backupCodes.length ? (
                <>
                  <div className={styles.footer} style={{ padding: 0 }}>
                    <p className={styles.rowTitle}>Códigos de recuperação</p>
                    <button type="button" className={page.button} onClick={() => copyText(backupCodes.join("\n"), "Códigos")}><Copy aria-hidden="true" size={16} /> Copiar todos</button>
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
            <button type="button" className={page.button} disabled={busy || !password} onClick={regenerateCodes}><KeyRound aria-hidden="true" size={16} /> Gerar novos códigos</button>
            <button type="button" className={page.button} data-tone="danger" disabled={busy || !password} onClick={disable}>Desativar 2FA</button>
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

  async function addPasskey() {
    setBusy("add");
    try {
      const finalName = name.trim() || (isMobile ? "Biometria Celular" : "Biometria do Dispositivo");
      const result = await authClient.passkey.addPasskey({ name: finalName, authenticatorAttachment: isMobile ? "platform" : attachmentType || "platform" });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível cadastrar a biometria.");
      await recordSecurityAuditAction("cadastrou_passkey");
      toast.success("Biometria cadastrada com sucesso.");
      setName("");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar a biometria.");
    } finally {
      setBusy("");
    }
  }

  async function renamePasskey() {
    if (!editingId || !editingName.trim()) return;
    setBusy("rename");
    try {
      const result = await authClient.passkey.updatePasskey({ id: editingId, name: editingName.trim() });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível renomear.");
      await recordSecurityAuditAction("renomeou_passkey");
      toast.success("Nome atualizado.");
      setEditingId(null);
      setEditingName("");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível renomear.");
    } finally {
      setBusy("");
    }
  }

  async function deletePasskey(id: string, label: string) {
    setBusy(id);
    try {
      const result = await authClient.passkey.deletePasskey({ id });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível excluir.");
      await recordSecurityAuditAction("excluiu_passkey");
      toast.success(`Biometria "${label}" removida.`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section id="passkey-section" className={styles.group} aria-labelledby="passkey-title">
      <div className={styles.row}>
        <div className={styles.rowText}>
          <h3 id="passkey-title" className={styles.rowTitle}>Chaves de acesso</h3>
          <p className={styles.rowDescription}>Use a digital ou o reconhecimento facial do aparelho para entrar com um toque, sem digitar senha.</p>
        </div>
        <button type="button" className={page.primaryButton} onClick={addPasskey} disabled={busy === "add"}>
          <Fingerprint aria-hidden="true" size={16} />
          {busy === "add" ? "Aguardando leitura..." : "Cadastrar biometria"}
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
                      <button type="button" className={page.primaryButton} onClick={renamePasskey} disabled={busy === "rename"}>Salvar nome</button>
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
                        <button type="button" className={page.iconButton} aria-label={`Excluir ${label}`} disabled={busy === passkey.id} onClick={() => setRemoving({ id: passkey.id, label })}>
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
