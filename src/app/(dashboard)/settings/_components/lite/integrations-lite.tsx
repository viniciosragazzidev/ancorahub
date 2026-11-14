"use client";

/**
 * "Integrações" no visual Lite: fontes de captura (webhooks e pixels). Mesmas Server Actions (criar, ativar ou
 * desativar, revogar), mesma atualização otimista, mesmo teste pelo endpoint público e o mesmo snippet. Revogar pede
 * confirmação Lite; a nova fonte e a ajuda abrem no painel lateral. A origem do snippet é lida depois da hidratação.
 *
 * Feedback (FEEDBACK.md, nível 1): criar, ativar ou desativar, revogar e o lead de teste confirmam na própria seção
 * depois do servidor; a falha desfaz a mudança otimista e mostra a causa com "Tentar de novo". Sem toast.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleHelp, Copy, FlaskConical, Plus } from "lucide-react";

import { LiteConfirmDialog, LiteSelect } from "@/components/lite/controls";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";

import { createIntegrationAction, revokeIntegrationAction, toggleIntegrationAction, type IntegrationRecord } from "../../integrations-actions";
import styles from "@/components/lite/page/lite-sections.module.css";
import { useFeedback } from "@/lib/feedback/use-feedback";

import { ActionNote, BusyLabel, useActionStatus } from "./action-status-lite";

type Branch = { id: string; name: string };

const SOURCE_LABEL: Record<string, string> = { site_pixel: "Pixel ou site", landing_page: "Landing page" };
const SOURCE_OPTIONS = [{ value: "site_pixel", label: "Pixel ou site" }, { value: "landing_page", label: "Landing page" }];
const FALLBACK_ORIGIN = "https://crm.ancorasaude.cloud";
const noop = () => () => {};

function useOrigin() {
  return useSyncExternalStore(noop, () => window.location.origin, () => FALLBACK_ORIGIN);
}

export function IntegrationsLite({ integrations, branches }: { integrations: IntegrationRecord[]; branches: Branch[] }) {
  const router = useRouter();
  const origin = useOrigin();
  const [list, setList] = useState<IntegrationRecord[]>(integrations);
  const [selectedId, setSelectedId] = useState<string | null>(integrations[0]?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [togglePendingId, setTogglePendingId] = useState<string | null>(null);
  const [revokePendingId, setRevokePendingId] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<{ leadId?: string; code?: string; message?: string } | null>(null);
  const [newSource, setNewSource] = useState("site_pixel");
  const [newBranch, setNewBranch] = useState("");
  const testNameRef = useRef<HTMLInputElement>(null);
  const testPhoneRef = useRef<HTMLInputElement>(null);
  const testEmailRef = useRef<HTMLInputElement>(null);
  const cancelRevoke = useCallback(() => setConfirmRevoke(false), []);
  const fire = useFeedback();
  const { status: feedback, confirm, fail, clear } = useActionStatus();

  useEffect(() => {
    setList(integrations);
  }, [integrations]);

  const selected = list.find((item) => item.id === selectedId) ?? list[0] ?? null;
  const branchName = (id: string | null) => branches.find((branch) => branch.id === id)?.name ?? null;

  async function handleCreate(formData: FormData) {
    const previous = list;
    const branchId = String(formData.get("branchId") ?? "") || null;
    const optimistic: IntegrationRecord = { id: `temp-${crypto.randomUUID()}`, name: String(formData.get("name") ?? "Nova fonte"), source: String(formData.get("source") ?? "site_pixel"), branchId, branchName: branchName(branchId), status: "active", tokenPrefix: "sincronizando⬦", createdAt: new Date() };
    setCreatePending(true);
    clear("sources");
    setList((current) => [optimistic, ...current]);
    setSelectedId(optimistic.id);
    setCreateOpen(false);
    try {
      const result = await createIntegrationAction({}, formData);
      if (!result.success || !result.integration) throw new Error(result.error ?? "Não foi possível criar a integração.");
      setList((current) => current.map((item) => item.id === optimistic.id ? { ...result.integration!, branchName: branchName(result.integration!.branchId) } : item));
      setSelectedId(result.integration.id);
      setRevealedToken(result.token ?? null);
      confirm("sources", "Fonte de captura criada. O token completo aparece só agora.");
      router.refresh();
    } catch (error) {
      setList(previous);
      setSelectedId(previous[0]?.id ?? null);
      fail("sources", error, { fallback: "Não foi possível criar a integração.", keeps: "As outras fontes continuam como estavam.", retry: () => void handleCreate(formData) });
    } finally {
      setCreatePending(false);
    }
  }

  async function handleToggle(id: string) {
    const previous = list;
    const wasActive = previous.find((item) => item.id === id)?.status === "active";
    setTogglePendingId(id);
    clear("config");
    setList((current) => current.map((item) => item.id === id ? { ...item, status: item.status === "active" ? "revoked" : "active" } : item));
    try {
      const formData = new FormData();
      formData.set("id", id);
      const result = await toggleIntegrationAction(formData);
      if (!result.success) throw new Error(result.error ?? "Não foi possível atualizar o status.");
      confirm("config", wasActive ? "Recebimento desativado" : "Recebimento ativado");
      router.refresh();
    } catch (error) {
      setList(previous);
      fail("config", error, { fallback: "Não foi possível atualizar o status.", keeps: wasActive ? "A fonte continua aceitando leads." : "A fonte continua bloqueada.", retry: () => void handleToggle(id) });
    } finally {
      setTogglePendingId(null);
    }
  }

  async function handleRevoke(id: string) {
    setRevokePendingId(id);
    clear("sources");
    try {
      const formData = new FormData();
      formData.set("id", id);
      await revokeIntegrationAction(formData);
      setList((current) => current.filter((item) => item.id !== id));
      setSelectedId(null);
      confirm("sources", "Integração revogada");
      router.refresh();
    } catch (error) {
      fail("sources", error, { fallback: "Não foi possível revogar a integração.", keeps: "A fonte continua recebendo leads.", retry: () => void handleRevoke(id) });
    } finally {
      setRevokePendingId(null);
    }
  }

  async function handleTest(event: FormEvent) {
    event.preventDefault();
    if (!selected || !revealedToken) return;
    setTestStatus("loading");
    setTestResult(null);
    fire("tap");
    try {
      const response = await fetch("/api/webhooks/leads/" + encodeURIComponent(revealedToken), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": "test-" + Date.now() },
        body: JSON.stringify({ nome: testNameRef.current?.value || "Lead de Teste", telefone: testPhoneRef.current?.value || "+5511999999999", email: testEmailRef.current?.value || undefined }),
      });
      const data = await response.json();
      if (data.success) {
        setTestStatus("success");
        setTestResult({ leadId: data.data?.leadId });
        fire("confirm");
      } else {
        fire("error");
        setTestStatus("error");
        setTestResult({ code: data.error?.code, message: data.error?.message });
      }
    } catch {
      fire("error");
      setTestStatus("error");
      setTestResult({ code: "NETWORK_ERROR", message: "Sem conexão com o servidor." });
    }
  }

  // ui-audit-ignore-start: HTML exportado para sites externos.
  const snippet = useMemo(() => {
    if (!selected) return "";
    const token = revealedToken ?? `${selected.tokenPrefix}⬢⬢⬢⬢⬢⬢⬢⬢`;
    return `<form data-ancora-form>
  <input type="text" name="nome" placeholder="Seu nome" required>
  <input type="tel" name="telefone" placeholder="Telefone" required>
  <input type="email" name="email" placeholder="E-mail">
  <select name="plano_interesse">
    <option value="individual">Individual</option>
    <option value="familiar">Familiar</option>
  </select>
  <!-- Honeypot: invisível ao visitante, bots preenchem -->
  <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
  <button type="submit">Quero uma cotação</button>
</form>

<script
  src="${origin}/embed/lead-form.js"
  data-token="${token}"></script>`;
  }, [origin, revealedToken, selected]);
  // ui-audit-ignore-end

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <>
      <div className={styles.group}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <p className={styles.rowTitle}>Catálogo de integrações</p>
            <p className={styles.rowDescription}>Escolha Meta, WhatsApp, fontes de site e os próximos conectores da operação.</p>
          </div>
          <Link href="/integrations" className={page.button}>Abrir integrações</Link>
        </div>
      </div>
      <div className={styles.split}>
        <section className={styles.group} aria-labelledby="sources-title">
          <div className={styles.row}>
            <div className={styles.rowText}>
              <h3 id="sources-title" className={styles.rowTitle}>Fontes de captura</h3>
              <p className={styles.rowDescription}>Webhooks e pixels que criam leads automaticamente.</p>
              {createPending ? <p className={styles.note} role="status">Gerando token…</p> : revokePendingId ? <p className={styles.note} role="status">Revogando…</p> : <ActionNote status={feedback.sources} />}
            </div>
            <div className={styles.actions}>
              <button type="button" className={page.iconButton} aria-label="Como integrar em um site externo" onClick={() => setHelpOpen(true)}>
                <CircleHelp aria-hidden="true" size={18} />
              </button>
              <button type="button" className={page.primaryButton} onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden="true" size={16} />
                Nova fonte
              </button>
            </div>
          </div>
          {list.length ? (
            <ul className={styles.list} aria-label="Fontes de captura">
              {list.map((item) => (
                <li key={item.id}>
                  <button type="button" className={styles.itemButton} aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)}>
                    <span className={styles.itemText}>
                      <span className={styles.itemTitle}>{item.name}</span>
                      <span className={styles.itemSub}>{SOURCE_LABEL[item.source] ?? item.source} · {item.branchName ?? "Primeira filial ativa"}</span>
                    </span>
                    {item.id.startsWith("temp-") ? <span className={page.badge}>Sincronizando</span> : (
                      <span className={page.badge} data-tone={item.status === "active" ? "success" : undefined}>{item.status === "active" ? "Ativo" : "Inativo"}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Nenhuma fonte configurada</p>
              <p>Crie um token para começar a receber leads automaticamente.</p>
            </div>
          )}
        </section>
        {selected ? (
          <section className={styles.group} aria-labelledby="source-config-title">
            <div className={styles.row}>
              <div className={styles.rowText}>
                <h3 id="source-config-title" className={styles.rowTitle}>Configuração da fonte</h3>
                <p className={styles.rowDescription}>{selected.name}</p>
              </div>
            </div>
            <div className={styles.formBody}>
              <div className={form.field}>
                <span className={form.label}>Token</span>
                <code className={styles.code}>{selected.tokenPrefix}⬢⬢⬢⬢⬢⬢⬢⬢</code>
                <span className={form.hint}>O token completo só aparece uma vez, logo depois da criação.</span>
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.rowText}>
                <p className={styles.rowTitle}>Recebimento</p>
                <p className={styles.rowDescription}>{selected.status === "active" ? "Aceitando novos leads" : "Bloqueado"}</p>
                <ActionNote status={feedback.config} />
              </div>
              <button type="button" className={page.button} disabled={togglePendingId === selected.id} aria-busy={togglePendingId === selected.id || undefined} onClick={() => handleToggle(selected.id)}>
                <BusyLabel busy={togglePendingId === selected.id} label="Salvando…">{selected.status === "active" ? "Desativar" : "Ativar"}</BusyLabel>
              </button>
            </div>
            <div className={styles.formBody}>
              <div className={styles.footer} style={{ padding: 0 }}>
                <p className={styles.rowTitle}>Snippet de integração</p>
                <button type="button" className={page.button} onClick={copySnippet}>
                  {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
                  {copied ? "Copiado" : "Copiar snippet"}
                </button>
              </div>
              <pre className={styles.code} style={{ maxHeight: 256, whiteSpace: "pre" }}>{snippet}</pre>
            </div>
            <div className={styles.formBody}>
              <div>
                <button type="button" className={page.button} aria-expanded={testOpen} onClick={() => { setTestOpen((value) => !value); setTestStatus("idle"); setTestResult(null); }}>
                  <FlaskConical aria-hidden="true" size={16} />
                  {testOpen ? "Fechar teste" : "Testar integração"}
                </button>
              </div>
              {testOpen ? (
                !revealedToken ? (
                  <div className={styles.notice} data-tone="warning">
                    <p className={styles.noticeTitle} data-tone="warning">Token não disponível</p>
                    <p className={styles.note}>O token completo só aparece logo depois da criação da integração. Crie uma nova fonte para testar.</p>
                  </div>
                ) : (
                  <form onSubmit={handleTest} className={form.form}>
                    <label className={form.field}>
                      <span className={form.label}>Nome (obrigatório)</span>
                      <input ref={testNameRef} className={form.input} placeholder="Ex.: Maria da Silva" defaultValue="Lead de Teste" />
                    </label>
                    <label className={form.field}>
                      <span className={form.label}>Telefone (obrigatório)</span>
                      <input ref={testPhoneRef} className={form.input} placeholder="+5511999999999" defaultValue="+5511999999999" />
                    </label>
                    <label className={form.field}>
                      <span className={form.label}>E-mail (opcional)</span>
                      <input ref={testEmailRef} className={form.input} type="email" placeholder="teste@email.com" />
                    </label>
                    <div>
                      <button type="submit" className={page.primaryButton} disabled={testStatus === "loading"} aria-busy={testStatus === "loading" || undefined}>
                        <BusyLabel busy={testStatus === "loading"} label="Enviando…">Enviar lead de teste</BusyLabel>
                      </button>
                    </div>
                    {testStatus === "success" && testResult ? (
                      <div className={styles.notice} data-tone="success" role="status">
                        <p className={styles.noticeTitle} data-tone="success">Webhook funcionando</p>
                        <p className={styles.note}>Lead ID: {testResult.leadId}</p>
                      </div>
                    ) : null}
                    {testStatus === "error" && testResult ? (
                      <div className={styles.notice} data-tone="danger" role="alert">
                        <p className={styles.noticeTitle} data-tone="danger">Falha no envio</p>
                        <p className={styles.note}>{testResult.code}: {testResult.message}</p>
                      </div>
                    ) : null}
                  </form>
                )
              ) : null}
            </div>
            <div className={styles.footer}>
              <button type="button" className={page.button} data-tone="danger" disabled={revokePendingId === selected.id} onClick={() => setConfirmRevoke(true)}>Revogar integração</button>
            </div>
          </section>
        ) : null}
      </div>
      <LiteSidePanel open={createOpen} onOpenChange={setCreateOpen} title="Nova fonte de captura" description="Gere um token seguro vinculado à corretora e, se quiser, a uma filial.">
        <form action={(formData) => void handleCreate(formData)} className={form.form}>
          <label className={form.field}>
            <span className={form.label}>Nome da fonte</span>
            <input className={form.input} name="name" placeholder="Landing page da filial Centro" required />
          </label>
          <LiteSelect label="Origem padrão" value={newSource} options={SOURCE_OPTIONS} onChange={setNewSource} />
          <input type="hidden" name="source" value={newSource} />
          <LiteSelect label="Filial de destino" value={newBranch} placeholder="Primeira filial ativa" options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} onChange={setNewBranch} />
          <input type="hidden" name="branchId" value={newBranch} />
          <div className={form.actions}>
            <button type="button" className={page.button} disabled={createPending} onClick={() => setCreateOpen(false)}>Cancelar</button>
            <button type="submit" className={page.primaryButton} disabled={createPending} aria-busy={createPending || undefined}><BusyLabel busy={createPending} label="Gerando token…">Gerar token</BusyLabel></button>
          </div>
        </form>
      </LiteSidePanel>
      <LiteSidePanel open={helpOpen} onOpenChange={setHelpOpen} title="Como integrar com a sua landing page" description="Cole um snippet no seu site e comece a receber leads na plataforma.">
        <IntegrationHelpLite />
      </LiteSidePanel>
      <LiteConfirmDialog
        open={confirmRevoke && Boolean(selected)}
        title="Revogar esta integração?"
        description={selected ? `"${selected.name}" deixa de receber leads e o token para de funcionar.` : undefined}
        confirmLabel="Revogar integração"
        tone="danger"
        onCancel={cancelRevoke}
        onConfirm={() => {
          setConfirmRevoke(false);
          if (selected) void handleRevoke(selected.id);
        }}
      />
    </>
  );
}

function IntegrationHelpLite() {
  return (
    <div className={form.form}>
      {/* ui-audit-ignore-start: exemplos HTML exibidos como código. */}
      <ol className={styles.steps}>
        <li>
          <strong>Marque o formulário com data-ancora-form.</strong> Use os campos nome e telefone (obrigatórios), email e plano_interesse (opcionais). Se os nomes forem outros, mapeie cada campo com data-ancora-field.
          <pre className={styles.code} style={{ whiteSpace: "pre", marginTop: 8 }}>{`<form data-ancora-form>
  <input data-ancora-field="nome" name="full_name" required>
  <input data-ancora-field="telefone" name="phone_number" required>
  <input data-ancora-field="email" name="email_address">
</form>`}</pre>
        </li>
        <li>
          <strong>Cole o script antes do fim do body,</strong> trocando SEU_TOKEN pelo token gerado. O script é estático e versionado e funciona em qualquer construtor.
          <pre className={styles.code} style={{ whiteSpace: "pre", marginTop: 8 }}>{`<script
  src="https://crm.ancorasaude.cloud/embed/lead-form.js"
  data-token="SEU_TOKEN"></script>`}</pre>
        </li>
        <li>
          <strong>Redirecionamento depois do envio (opcional):</strong> adicione data-redirect no script.
          <pre className={styles.code} style={{ whiteSpace: "pre", marginTop: 8 }}>{`<script
  src="https://crm.ancorasaude.cloud/embed/lead-form.js"
  data-token="SEU_TOKEN"
  data-redirect="/obrigado"></script>`}</pre>
        </li>
        <li>
          <strong>Teste com curl.</strong>
          <pre className={styles.code} style={{ whiteSpace: "pre", marginTop: 8 }}>{`curl -X POST \\
  "https://crm.ancorasaude.cloud/api/webhooks/leads/SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"nome":"Maria","telefone":"+5521999999999"}'`}</pre>
        </li>
      </ol>
      {/* ui-audit-ignore-end */}
      <div className={styles.notice}>
        <p className={styles.noticeTitle}>Proteção contra bots</p>
        <p className={styles.note}>O formulário inclui o campo invisível website. Se vier preenchido, o lead é descartado em silêncio.</p>
      </div>
      <div className={styles.notice}>
        <p className={styles.noticeTitle}>Segurança</p>
        <p className={styles.note}>O token só cria leads, nunca lê nem exporta dados. Há limite de envios por token. Se o token vazar, revogue nesta tela.</p>
      </div>
      <div className={styles.notice}>
        <p className={styles.noticeTitle}>Códigos de resposta</p>
        <p className={styles.note}>201 lead criado, 200 lead duplicado (idempotente), 401 token inválido, 422 dados inválidos, 409 conflito de idempotência, 500 erro interno.</p>
      </div>
      <Link href="/guia/webhook" className={styles.link}>Ver tutorial completo</Link>
    </div>
  );
}
