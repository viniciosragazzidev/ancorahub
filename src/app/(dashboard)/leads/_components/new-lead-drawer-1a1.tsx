"use client";

/**
 * "Novo lead" no Lite (27/11/2026), cópia 1:1 do artifact "Leads da gestão": gaveta lateral no mesmo desenho da gaveta
 * do lead (fundo da página, raio 1.75rem, cartões). Mesmos campos, validação, aviso de telefone duplicado e `formData`
 * do ManualLeadForm de hoje, e a mesma ação de servidor (createManualLeadAction).
 */
import { useActionState, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { toast } from "@/components/ui/sonner";
import { CnpjLookupPanel } from "@/features/companies/components/cnpj-lookup-panel";
import { useActionDialogLifecycle } from "@/hooks/use-action-dialog-lifecycle";

import { consultarCnpjAction } from "../../empresas/actions";
import { createManualLeadAction, type LeadCreateState } from "../actions";
import styles from "../leads-1a1.module.css";

type PlanOption = { id: string; name: string; carrierName: string };
const initialState: LeadCreateState = {};

function Chevron() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
}

export function NewLeadDrawer1a1({ plans, open, onOpenChange }: { plans: PlanOption[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);
  // Só abre depois de um toque, então o document já existe; no servidor fica fechada.
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className={`arc-venancor ${styles.gx}`} data-skin="diretor">
      <div className={styles.scrim} aria-hidden="true" onClick={() => onOpenChange(false)} />
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label="Novo lead">
        <div className={styles.drawerHead}>
          <div style={{ flex: 1 }}>
            <p className={styles.drawerTitle}>Novo lead</p>
            <p className={styles.drawerText}>Cadastre uma indicação ou contato recebido fora de uma campanha.</p>
          </div>
          <button type="button" className={styles.iconbtn} aria-label="Fechar" onClick={() => onOpenChange(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" style={{ width: 16, height: 16 }}><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <NewLeadForm plans={plans} />
      </aside>
    </div>,
    document.body,
  );
}

function NewLeadForm({ plans }: { plans: PlanOption[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createManualLeadAction, initialState);
  const handleSuccess = useCallback((result: LeadCreateState) => {
    if (!result.leadId) return;
    toast.success("Lead criado com sucesso.");
    router.push(`/leads/${result.leadId}`);
  }, [router]);
  const handleError = useCallback((result: LeadCreateState) => {
    if (result.error) toast.error(result.error);
  }, []);
  useActionDialogLifecycle({ state, pending, onSuccess: handleSuccess, onError: handleError });

  const [tipo, setTipo] = useState<"PF" | "PJ">("PF");
  const [dependentes, setDependentes] = useState("");
  const [mediaIdades, setMediaIdades] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [funcionarios, setFuncionarios] = useState("");

  return (
    <form action={action} style={{ display: "contents" }}>
      <section className={`${styles.card} ${styles.section}`}>
        <p className={styles.sectionTitle}>Contato</p>
        <label className={styles.field}>Nome completo<input className={styles.input} name="nome" placeholder="Ex.: Mariana Costa" required /></label>
        <label className={styles.field}>Celular<input className={`${styles.input} ${styles.num}`} name="telefone" inputMode="tel" placeholder="(11) 99999-9999" required /></label>
        <div className={styles.grid2}>
          <label className={styles.field}>E-mail (opcional)<input className={styles.input} name="email" type="email" placeholder="nome@email.com" /></label>
          <label className={styles.field}>Plano (opcional)
            <span className={styles.selectWrap}>
              <select className={styles.input} name="planoInteresseId" defaultValue="">
                <option value="">Selecione</option>
                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.carrierName} · {plan.name}</option>)}
              </select>
              <Chevron />
            </span>
          </label>
        </div>
      </section>

      <section className={`${styles.card} ${styles.section}`}>
        <div className={styles.rowBetween}>
          <p className={styles.sectionTitle}>Tipo do lead</p>
          <div role="group" aria-label="Tipo do lead" className={styles.seg}>
            <button type="button" className={styles.segbtn} aria-pressed={tipo === "PF"} onClick={() => setTipo("PF")}>Pessoa física</button>
            <button type="button" className={styles.segbtn} aria-pressed={tipo === "PJ"} onClick={() => setTipo("PJ")}>Empresa</button>
          </div>
        </div>
        <input type="hidden" name="tipo" value={tipo} />
        {tipo === "PF" ? (
          <div className={styles.grid2}>
            <label className={styles.field}>Dependentes<input className={`${styles.input} ${styles.num}`} name="dependentes" type="number" min={0} max={99} placeholder="Ex.: 2" value={dependentes} onChange={(event) => setDependentes(event.target.value)} /></label>
            <label className={styles.field}>Média de idades<input className={`${styles.input} ${styles.num}`} name="mediaIdades" type="number" min={0} max={120} placeholder="Ex.: 35" value={mediaIdades} onChange={(event) => setMediaIdades(event.target.value)} /></label>
          </div>
        ) : (
          <>
            <label className={styles.field}>Razão social<input className={styles.input} name="razaoSocial" placeholder="Ex.: Empresa Exemplo Ltda." value={razaoSocial} onChange={(event) => setRazaoSocial(event.target.value)} /></label>
            <div className={styles.grid2b}>
              <label className={styles.field}>CNPJ<input className={`${styles.input} ${styles.num}`} name="cnpj" placeholder="00.000.000/0001-00" value={cnpj} onChange={(event) => setCnpj(event.target.value)} /></label>
              <label className={styles.field}>Funcionários<input className={`${styles.input} ${styles.num}`} name="funcionarios" type="number" min={0} max={99999} placeholder="Ex.: 50" value={funcionarios} onChange={(event) => setFuncionarios(event.target.value)} /></label>
            </div>
            <CnpjLookupPanel
              value={cnpj}
              onValueChange={setCnpj}
              hideInput
              onLookup={consultarCnpjAction}
              onUse={async (data) => {
                setRazaoSocial(data.legalName);
                return { ok: true };
              }}
              useDoneLabel="Razão social preenchida"
              useHint="Preenche a razão social deste formulário."
            />
          </>
        )}
      </section>

      <label className={`${styles.card} ${styles.consent}`}>
        <input type="checkbox" className={styles.checkInput} name="consentimentoLgpd" value="true" required />
        <span>
          <span className={styles.consentTitle}>Consentimento LGPD</span>
          <span className={styles.consentText}>O cliente autorizou o tratamento dos dados para fins de contratação de plano de saúde.</span>
        </span>
      </label>

      {state.duplicate ? (
        <div className={`${styles.card} ${styles.warnCard}`} role="status">
          <p><strong>Já existe um lead com este telefone:</strong> {state.duplicate.nome}.</p>
          <label className={styles.inlineCheck}>
            <input type="checkbox" className={styles.checkInput} name="duplicateConfirmed" value="true" required />
            Confirmo que é um novo contato
          </label>
        </div>
      ) : null}

      {state.error ? <p className={styles.errorText} role="alert">{state.error}</p> : null}

      <button type="submit" className={`${styles.pill} ${styles.pillPrimary} ${styles.fullWidth}`} disabled={pending}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
        {pending ? "Salvando…" : "Criar lead"}
      </button>
      <p className={styles.footNote}>Unidade, origem e atribuição são definidas pelo servidor.</p>

      <input
        type="hidden"
        name="formData"
        value={JSON.stringify({
          dependentes: dependentes || null,
          mediaIdades: mediaIdades || null,
          razaoSocial: razaoSocial || null,
          cnpj: cnpj || null,
          funcionarios: funcionarios || null,
        })}
      />
    </form>
  );
}
