"use client";

/**
 * /integrations/meta no visual Lite (Onda 7): a mesma conexão (sincronizar, revisar ativos, desconectar com
 * confirmação), os mesmos avisos de permissão, os ativos autorizados com 15 por página e o mapa de aquisição que só
 * entra no DOM quando aberto. O assistente de conexão é o mesmo da tela atual (camada com a pele Lite).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Power, RefreshCw, Zap } from "lucide-react";

import { LiteConfirmDialog } from "@/components/lite/controls";
import { LitePagination } from "@/components/lite/data/pagination";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { disconnectMetaConnection, triggerManualMetaSync } from "../../actions";
import type { MetaConnectionAssets, MetaConnectionInfo } from "../../types";
import { MetaMarketingWizard } from "../meta-marketing-wizard";
import type { MetaSyncInfo } from "./meta-lite-shared";
import styles from "./meta-lite.module.css";
import integration from "./meta-integration-lite.module.css";

const PAGE_SIZE = 15;
const count = new Intl.NumberFormat("pt-BR");
const activeStatus = (status: string) => status === "active" || status === "ACTIVE";

function getPermissionWarning(lastError: string | null | undefined) {
  if (!lastError) return null;
  try {
    const parsed = JSON.parse(lastError) as { warnings?: Array<{ code?: string; message?: string }> };
    return parsed.warnings?.find((warning) => warning.code === "missing_ads_read")?.message ?? null;
  } catch {
    return null;
  }
}

export function MetaIntegrationLite({ connection, assets, sync, captureModeLabel, canConfigure }: {
  connection: MetaConnectionInfo | null;
  assets: MetaConnectionAssets | null;
  sync: MetaSyncInfo | null;
  captureModeLabel: string | null;
  canConfigure: boolean;
}) {
  const [syncing, setSyncing] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [disconnecting, startDisconnecting] = useTransition();
  const router = useRouter();
  const connected = connection?.status === "connected";
  const permissionWarning = getPermissionWarning(connection?.lastError);

  const runSync = async () => {
    setSyncing(true);
    try {
      const result = await triggerManualMetaSync();
      if (!result.success) {
        toast.error(result.error ?? "A sincronização não foi concluída.");
        return;
      }
      if (result.warnings?.length) {
        toast.warning("Sincronização parcial da Meta.", { description: result.warnings[0]?.message });
      } else {
        toast.success("Ativos sincronizados.");
      }
      router.refresh();
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = () => {
    if (disconnecting) return;
    startDisconnecting(async () => {
      try {
        await disconnectMetaConnection();
        setDisconnectOpen(false);
        toast.success("Conexão de Marketing desconectada.", { description: "Ativos e captura foram liberados; o histórico foi preservado." });
        router.refresh();
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : "Não foi possível desconectar a Meta agora.");
      }
    });
  };

  return (
    <>
      {!canConfigure ? (
        <section className={integration.notice} role="note">
          <h2 className={integration.noticeTitle}>Visualização operacional</h2>
          <p className={page.cardDescription}>Somente o Diretor ou time de Marketing pode iniciar, alterar ou desconectar a integração de Marketing Meta desta corretora.</p>
        </section>
      ) : null}

      <section className={page.card} aria-labelledby="meta-connection-title">
        <div className={styles.cardHeadRow}>
          <div className={page.cardHead}>
            <h2 id="meta-connection-title" className={page.cardTitle}>Meta Ads e Lead Ads</h2>
            <p className={page.cardDescription}>Conexão exclusiva de Marketing para páginas, campanhas, formulários, pixels e filas.</p>
          </div>
          <span className={page.badge} data-tone={connected ? "success" : undefined}>{connected ? "Conectada" : "Não conectada"}</span>
        </div>

        {connected && sync ? (
          <div className={integration.syncRow} title={sync.title}>
            <div className={styles.statusItems}>
              <span className={page.badge} data-tone={sync.tone}>Última sincronização: {sync.label}</span>
              {sync.detail ? <span className={styles.statusText}>{sync.detail}</span> : null}
              {captureModeLabel ? <span className={page.badge}>{captureModeLabel}</span> : null}
              {sync.errorDetails ? (
                <details className={styles.errorDetails}>
                  <summary>Ver motivo da falha</summary>
                  <p>{sync.errorDetails}</p>
                </details>
              ) : null}
            </div>
            <Link href="/marketing/campanhas" className={styles.linkButton}>
              Gerenciar captura e filas <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        ) : null}

        <div className={page.toolbar}>
          {connected ? (
            <>
              <button type="button" className={page.button} disabled={syncing || !canConfigure} onClick={() => void runSync()}>
                <RefreshCw aria-hidden="true" size={16} /> {syncing ? "Sincronizando…" : "Sincronizar"}
              </button>
              <button type="button" className={page.button} disabled={!canConfigure} onClick={() => setWizardOpen(true)}>
                <Zap aria-hidden="true" size={16} /> {permissionWarning ? "Reconectar permissões" : "Revisar ativos"}
              </button>
              <button type="button" className={`${page.button} ${styles.dangerButton}`} disabled={!canConfigure || disconnecting} onClick={() => setDisconnectOpen(true)}>
                <Power aria-hidden="true" size={16} /> Desconectar
              </button>
            </>
          ) : (
            <button type="button" className={page.primaryButton} disabled={!canConfigure} onClick={() => setWizardOpen(true)}>
              <Zap aria-hidden="true" size={16} /> Conectar Marketing
            </button>
          )}
        </div>

        {permissionWarning ? (
          <div role="alert" className={integration.warning}>
            <p className={integration.noticeTitle}>Permissão de anúncios necessária</p>
            <p className={page.cardDescription}>{permissionWarning}</p>
            <p className={page.cellSub}>A reconexão abre o consentimento da Meta novamente. Nenhum histórico ou fila do CRM será apagado.</p>
          </div>
        ) : null}
      </section>

      {connected && assets && connection ? (
        <section className={page.group} aria-labelledby="meta-assets-title">
          <div className={page.cardHead}>
            <h2 id="meta-assets-title" className={page.cardTitle}>Ativos conectados</h2>
            <p className={page.cardDescription}>Visão dos ativos autorizados para esta corretora. Para escolher o que captura leads e para qual fila, use Marketing, Campanhas.</p>
          </div>
          <div className={page.stats}>
            <div className={page.stat}>
              <span className={page.statLabel}>Portfólio empresarial</span>
              <span className={integration.business} title={connection.businessName ?? undefined}>{connection.businessName ?? "Nome não informado"}</span>
              <span className={page.cellSub}>{connection.businessId}</span>
            </div>
            <div className={page.stat}><span className={page.statLabel}>Páginas autorizadas</span><span className={page.statValue}>{count.format(assets.pages.length)}</span></div>
            <div className={page.stat}><span className={page.statLabel}>Campanhas sincronizadas</span><span className={page.statValue}>{count.format(assets.campaigns.length)}</span></div>
            <div className={page.stat}><span className={page.statLabel}>Anúncios sincronizados</span><span className={page.statValue}>{count.format(assets.ads.length)}</span></div>
            <div className={page.stat}><span className={page.statLabel}>Formulários sincronizados</span><span className={page.statValue}>{count.format(assets.leadForms.length)}</span></div>
          </div>

          <div className={integration.lists}>
            <AssetList title="Páginas conectadas" empty="Nenhuma página selecionada." items={assets.pages.map((asset) => ({ ...asset, detail: asset.id }))} />
            <AssetList title="Contas de anúncios" empty="Nenhuma conta de anúncios selecionada." items={assets.adAccounts.map((asset) => ({ ...asset, detail: `${asset.id} · ${asset.currency}` }))} />
            <AssetList title="Pixels" empty="Nenhum pixel sincronizado ainda." items={assets.pixels.map((asset) => ({ ...asset, detail: asset.id }))} />
            <AssetList title="Fontes" empty="Nenhuma fonte sincronizada ainda." items={assets.datasets.map((asset) => ({ ...asset, detail: asset.id }))} />
          </div>

          <details className={integration.map} onToggle={(event) => setMapOpen(event.currentTarget.open)}>
            <summary className={integration.mapSummary}>
              <span>Mapa de aquisição</span>
              <span className={page.muted}>{mapOpen ? "Ocultar" : "Mostrar"}</span>
            </summary>
            {mapOpen ? <AcquisitionMap campaigns={assets.campaigns} ads={assets.ads} forms={assets.leadForms} pages={assets.pages} /> : null}
          </details>
        </section>
      ) : null}

      {wizardOpen ? <MetaMarketingWizard onClose={() => setWizardOpen(false)} /> : null}
      <LiteConfirmDialog
        open={disconnectOpen}
        title="Desconectar Marketing da Meta?"
        description="As páginas, campanhas, formulários, pixels e filas deixam de sincronizar. A captura é interrompida, a Página fica disponível para uma conexão futura e o histórico já capturado é preservado."
        confirmLabel={disconnecting ? "Desconectando…" : "Desconectar"}
        tone="danger"
        onConfirm={handleDisconnect}
        onCancel={() => { if (!disconnecting) setDisconnectOpen(false); }}
      />
    </>
  );
}

function AssetList({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; name: string; status: string; detail: string }> }) {
  const sorted = [...items].sort((a, b) => {
    const aActive = activeStatus(a.status);
    const bActive = activeStatus(b.status);
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return a.name.localeCompare(b.name);
  });
  const [current, setCurrent] = useState(1);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(current, totalPages);
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section className={page.card} aria-label={title}>
      <div className={integration.listHead}>
        <h3 className={integration.listTitle}>{title}</h3>
        <span className={page.cellSub}>{items.length} {items.length === 1 ? "item" : "itens"}</span>
      </div>
      {visible.length ? (
        <ul className={integration.rows}>
          {visible.map((item) => (
            <li key={item.id} className={integration.row}>
              <span className={integration.rowText}>
                <span className={page.cellTitle} title={item.name}>{item.name}</span>
                <span className={page.cellSub}>{item.detail}</span>
              </span>
              <span className={page.badge} data-tone={activeStatus(item.status) ? "success" : undefined}>{activeStatus(item.status) ? "Ativo" : item.status}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={page.cardDescription}>{empty}</p>
      )}
      <LitePagination page={safePage} totalPages={totalPages} totalItems={sorted.length} pageSize={PAGE_SIZE} onPageChange={setCurrent} label={`Páginas de ${title.toLowerCase()}`} />
    </section>
  );
}

function AcquisitionMap({ campaigns, ads, forms, pages }: {
  campaigns: MetaConnectionAssets["campaigns"];
  ads: MetaConnectionAssets["ads"];
  forms: MetaConnectionAssets["leadForms"];
  pages: MetaConnectionAssets["pages"];
}) {
  const pageNameById = new Map(pages.map((item) => [item.id, item.name]));
  const formsByPage = new Map<string, typeof forms>();
  for (const form of forms) {
    const pageForms = formsByPage.get(form.pageId) ?? [];
    pageForms.push(form);
    formsByPage.set(form.pageId, pageForms);
  }

  return (
    <section aria-label="Mapa de ativos Meta" className={integration.mapBody}>
      <p className={page.cardDescription}>Relação operacional entre campanha, anúncio e formulário. Os IDs ficam visíveis apenas como referência técnica.</p>
      <div className={integration.mapGrid}>
        <div className={integration.mapColumn}>
          <h3 className={integration.listTitle}>Campanhas e anúncios</h3>
          {campaigns.length ? campaigns.map((campaign) => {
            const campaignAds = ads.filter((ad) => ad.campaignId === campaign.id);
            return (
              <div key={campaign.id} className={integration.mapItem}>
                <div className={integration.row}>
                  <span className={integration.rowText}>
                    <span className={page.cellTitle} title={campaign.name}>{campaign.name}</span>
                    <span className={page.cellSub}>Campanha · {campaign.id}</span>
                  </span>
                  <span className={page.badge} data-tone={campaign.isEligibleForCapture ? "success" : undefined}>{campaign.isEligibleForCapture ? "Captura ativa" : "Fora da captura"}</span>
                </div>
                {campaignAds.length ? (
                  <ul className={integration.mapChildren}>
                    {campaignAds.map((ad) => (
                      <li key={ad.id} className={integration.row}>
                        <span className={integration.rowText}>
                          <span className={page.cellTitle} title={ad.name}>{ad.name}</span>
                          <span className={page.cellSub}>Anúncio · {ad.id} · Conjunto · {ad.adSetId}</span>
                        </span>
                        <span className={page.badge} data-tone={ad.isEligibleForCapture ? "success" : undefined}>{ad.isEligibleForCapture ? "Elegível" : "Desativado"}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className={page.cellSub}>Nenhum anúncio sincronizado.</p>}
              </div>
            );
          }) : <p className={page.cardDescription}>Nenhuma campanha sincronizada.</p>}
        </div>
        <div className={integration.mapColumn}>
          <h3 className={integration.listTitle}>Formulários por página</h3>
          {formsByPage.size ? [...formsByPage.entries()].map(([pageId, pageForms]) => (
            <div key={pageId} className={integration.mapItem}>
              <span className={integration.rowText}>
                <span className={page.cellTitle}>{pageNameById.get(pageId) ?? "Página sem nome"}</span>
                <span className={page.cellSub}>Página · {pageId}</span>
              </span>
              <ul className={integration.mapChildren}>
                {pageForms.map((form) => (
                  <li key={form.id} className={integration.row}>
                    <span className={integration.rowText}>
                      <span className={page.cellTitle} title={form.name}>{form.name}</span>
                      <span className={page.cellSub}>Formulário · {form.id}</span>
                    </span>
                    <span className={page.badge} data-tone={form.isEligibleForCapture ? "success" : undefined}>{form.isEligibleForCapture ? "Elegível" : "Desativado"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )) : <p className={page.cardDescription}>Nenhum formulário sincronizado.</p>}
          <p className={page.cellSub}>A Meta mantém formulários no nível da Página. A ligação com a campanha só é exibida quando o anúncio fornece essa atribuição.</p>
        </div>
      </div>
      <div className={integration.flow}>
        <h3 className={integration.listTitle}>Fluxo operacional</h3>
        <ol className={integration.flowSteps}>
          <li><strong>Recuperado:</strong> a Meta envia o lead pelo webhook e a atribuição é preservada.</li>
          <li><strong>Consumido:</strong> o CRM valida o modo global e a regra mais específica ativa.</li>
          <li><strong>Distribuído:</strong> a fila da regra recebe o lead; sem fila específica, vale a fila padrão.</li>
        </ol>
      </div>
    </section>
  );
}
