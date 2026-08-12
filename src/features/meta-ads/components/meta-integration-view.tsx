"use client";

import { useEffect, useState } from "react";
import { ArrowsClockwise, Globe, Lightning, Power, Warning } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { beginMetaMarketingConnection, confirmMetaConnection, disconnectMetaConnection, getMetaMarketingAttemptAssets, triggerManualMetaSync } from "../actions";
import type { MetaConnectionInfo, MetaDiscoveredAssets, MetaSyncLogItem } from "../types";
import { MetaAssetsModal } from "./meta-assets-modal";

const DEFAULT_META_APP_ID = "780859815090303";

export function MetaIntegrationView({ connection, logs, canConfigure = true }: { connection: MetaConnectionInfo | null; logs: MetaSyncLogItem[]; canConfigure?: boolean }) {
  const [loading, setLoading] = useState(false); const [syncing, setSyncing] = useState(false); const [open, setOpen] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null); const [assets, setAssets] = useState<MetaDiscoveredAssets | null>(null); const [error, setError] = useState<string | null>(null);
  const connected = connection?.status === "connected";
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "META_MARKETING_AUTH_ERROR") { setLoading(false); setError("A Meta não concluiu a autorização. Tente novamente."); }
      if (event.data?.type === "META_MARKETING_AUTH_SUCCESS" && typeof event.data.attemptId === "string") {
        void getMetaMarketingAttemptAssets(event.data.attemptId).then((result) => { setAttemptId(event.data.attemptId); setAssets(result); setOpen(false); }).catch(() => setError("A autorização expirou. Recomece a conexão."));
        setLoading(false);
      }
    };
    window.addEventListener("message", listener); return () => window.removeEventListener("message", listener);
  }, []);
  const connect = async () => {
    setLoading(true); setError(null);
    try {
      const { state } = await beginMetaMarketingConnection();
      const redirectUri = `${window.location.origin}/api/integrations/meta/lead-ads/callback`;
      const url = new URL("https://www.facebook.com/v25.0/dialog/oauth");
      url.search = new URLSearchParams({ client_id: process.env.NEXT_PUBLIC_META_LEAD_ADS_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || DEFAULT_META_APP_ID, redirect_uri: redirectUri, state, response_type: "code", scope: "pages_show_list,pages_read_engagement,pages_manage_metadata,leads_retrieval,ads_read" }).toString();
      const popup = window.open(url, "MetaMarketingOAuth", "width=600,height=700,scrollbars=yes,status=yes");
      if (!popup) { setLoading(false); setError("Permita popups para conectar a Meta."); }
    } catch { setLoading(false); setError("Não foi possível iniciar a conexão com a Meta."); }
  };
  const confirmAssets = async (payload: { businessId: string; businessName: string; pages: Array<{ id: string; name: string }>; adAccounts: Array<{ id: string; name: string; currency: string }> }) => {
    if (!attemptId) throw new Error("Autorização expirada.");
    await confirmMetaConnection({ attemptId, ...payload }); setAssets(null);
  };
  return <div className="space-y-6"><Card className="border-border bg-card shadow-none"><CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><Globe className="size-5 text-primary" />Meta Ads e Lead Ads</CardTitle><CardDescription>Conexão exclusiva de Marketing para páginas, campanhas, formulários, pixels e filas.</CardDescription></div><Badge variant={connected ? "success" : "outline"}>{connected ? "Conectada" : "Não conectada"}</Badge></CardHeader><CardContent className="flex flex-wrap gap-2">{connected ? <><Button variant="outline" disabled={syncing || !canConfigure} onClick={async () => { setSyncing(true); try { await triggerManualMetaSync(); } finally { setSyncing(false); } }}><ArrowsClockwise className="size-4" />{syncing ? "Sincronizando…" : "Sincronizar"}</Button><Button variant="outline" disabled={!canConfigure} onClick={() => void disconnectMetaConnection()}><Power className="size-4" />Desconectar</Button></> : <Button disabled={loading || !canConfigure} onClick={() => setOpen(true)}><Lightning className="size-4" />Conectar Marketing</Button>}{error ? <p role="alert" className="flex w-full gap-2 text-sm text-destructive"><Warning className="size-4" />{error}</p> : null}</CardContent></Card><Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>Sincronizações recentes</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{logs.length ? logs.map((log) => <div className="flex justify-between rounded-md border border-border p-3" key={log.id}><span>{log.syncType}</span><span>{log.status} · {log.itemsSynced} itens</span></div>) : <p className="text-muted-foreground">Nenhuma sincronização registrada.</p>}</CardContent></Card><Dialog open={open} onOpenChange={setOpen}><DialogPopup><DialogHeader><DialogTitle>Conectar Marketing da Meta</DialogTitle><DialogDescription>Você selecionará apenas os ativos que pertencem à sua corretora. O WhatsApp é conectado separadamente.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={loading} onClick={() => void connect()}>{loading ? "Abrindo Meta…" : "Continuar com Facebook"}</Button></DialogFooter></DialogPopup></Dialog><MetaAssetsModal open={Boolean(assets)} onOpenChange={(value) => { if (!value) setAssets(null); }} assets={assets} onConfirm={confirmAssets} /></div>;
}
