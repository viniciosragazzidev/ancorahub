"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle, Globe, SquaresFour, UserList } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import type { MetaDiscoveredAssets } from "../types";

export function MetaAssetsModal({ open, onOpenChange, assets, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: MetaDiscoveredAssets | null;
  onConfirm: (payload: { businessId: string; businessName: string; pages: Array<{ id: string; name: string }>; adAccounts: Array<{ id: string; name: string; currency: string }> }) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!assets) return null;
  const confirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({ businessId: assets.business.id, businessName: assets.business.name, pages: assets.pages.map(({ id, name }) => ({ id, name })), adAccounts: assets.adAccounts.map(({ id, name, currency }) => ({ id, name, currency })) });
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a conexão.");
    } finally { setSubmitting(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogPopup className="max-h-[85vh] max-w-xl overflow-y-auto"><DialogHeader><Badge variant="outline" className="w-fit bg-emerald-500/10 text-emerald-700">OAuth de Marketing</Badge><DialogTitle>Ativos autorizados</DialogTitle><DialogDescription>Confirme somente os ativos da corretora. Esta etapa grava a conexão e ativa a sincronização; o WhatsApp possui um conector independente.</DialogDescription></DialogHeader><div className="space-y-3 py-2"><Card><CardHeader className="p-3 pb-1"><CardTitle className="flex items-center gap-2 text-sm"><Globe className="size-4 text-primary" />Business Manager</CardTitle></CardHeader><CardContent className="p-3 pt-1"><p className="font-medium">{assets.business.name}</p><p className="font-mono text-xs text-muted-foreground">{assets.business.id}</p></CardContent></Card><AssetCard icon={<UserList className="size-4 text-chart-3" />} title={`Páginas (${assets.pages.length})`} items={assets.pages.map((asset) => ({ id: asset.id, label: asset.name }))} empty="Nenhuma página autorizada." /><AssetCard icon={<SquaresFour className="size-4 text-chart-2" />} title={`Contas de anúncios (${assets.adAccounts.length})`} items={assets.adAccounts.map((asset) => ({ id: asset.id, label: asset.name, meta: asset.currency }))} empty="Nenhuma conta de anúncios autorizada." />{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}</div><DialogFooter><Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button><Button size="sm" onClick={() => void confirm()} disabled={submitting}><CheckCircle className="size-4" />{submitting ? "Conectando..." : "Confirmar e conectar"}</Button></DialogFooter></DialogPopup></Dialog>;
}

function AssetCard({ icon, title, items, empty }: { icon: ReactNode; title: string; items: Array<{ id: string; label: string; meta?: string }>; empty: string }) {
  return <Card><CardHeader className="p-3 pb-1"><CardTitle className="flex items-center gap-2 text-sm">{icon}{title}</CardTitle></CardHeader><CardContent className="space-y-1 p-3 pt-1">{items.length ? items.map((item) => <div className="flex items-center justify-between border-b py-1 text-sm last:border-0" key={item.id}><span>{item.label}</span><span className="font-mono text-xs text-muted-foreground">{item.meta || item.id}</span></div>) : <p className="text-sm text-muted-foreground">{empty}</p>}</CardContent></Card>;
}
