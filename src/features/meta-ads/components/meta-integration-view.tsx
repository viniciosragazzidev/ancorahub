"use client";

import { useState } from "react";
import {
  ArrowsClockwise,
  CheckCircle,
  Clock,
  Globe,
  Lightning,
  Phone,
  Power,
  SealCheck,
  ShieldCheck,
  UserList,
  Warning,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { confirmMetaConnection, disconnectMetaConnection, discoverMetaAssetsFromAuthCode, triggerManualMetaSync } from "../actions";
import type { MetaConnectionInfo, MetaDiscoveredAssets, MetaSyncLogItem } from "../types";
import { MetaAssetsModal } from "./meta-assets-modal";

export function MetaIntegrationView({
  connection,
  logs,
}: {
  connection: MetaConnectionInfo | null;
  logs: MetaSyncLogItem[];
}) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [assetsModalOpen, setAssetsModalOpen] = useState(false);
  const [discoveredAssets, setDiscoveredAssets] = useState<MetaDiscoveredAssets | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isConnected = connection?.status === "connected";

  const handleLaunchEmbeddedSignup = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      // Simulação / Preparação do fluxo Embedded Signup v4
      // Em produção: FB.login() via SDK com config_id do Meta App Dashboard
      const mockAuthCode = "mock_code_" + Date.now();
      const redirectUri = typeof window !== "undefined" ? `${window.location.origin}/api/meta/oauth/callback` : "";

      const assets = await discoverMetaAssetsFromAuthCode(mockAuthCode, redirectUri);
      setDiscoveredAssets(assets);
      setAssetsModalOpen(true);
    } catch (err: any) {
      setErrorMessage(err?.message || "Falha ao iniciar o Facebook Login for Business.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAssets = async (payload: {
    businessId: string;
    businessName: string;
    pages: Array<{ id: string; name: string }>;
    adAccounts: Array<{ id: string; name: string; currency: string }>;
    whatsapp?: { wabaId: string; phoneNumberId: string; displayPhoneNumber: string } | null;
  }) => {
    await confirmMetaConnection({
      businessId: payload.businessId,
      businessName: payload.businessName,
      pages: payload.pages,
      adAccounts: payload.adAccounts,
      whatsapp: payload.whatsapp,
    });
  };

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      await triggerManualMetaSync();
    } catch (err: any) {
      setErrorMessage(err?.message || "Falha ao executar sincronização manual.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Deseja realmente desconectar a conta Meta?")) return;
    try {
      setLoading(true);
      await disconnectMetaConnection();
    } catch (err: any) {
      setErrorMessage(err?.message || "Falha ao desconectar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── STATUS DA INTEGRAÇÃO ─── */}
      <Card className="rounded-2xl border border-border bg-card p-6 shadow-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex size-12 items-center justify-center rounded-xl ${isConnected ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
              {isConnected ? <SealCheck className="size-6" weight="fill" /> : <Globe className="size-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">Meta Ads & Marketing</h2>
                <Badge variant={isConnected ? "success" : "outline"} className="gap-1.5 font-mono text-[11px] font-semibold">
                  <span className={`size-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
                  {isConnected ? "🟢 Conectado" : "⚪ Não conectado"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isConnected
                  ? `Conectado à empresa ${connection?.businessName || connection?.businessId} via Embedded Signup v4.`
                  : "Conecte sua conta Meta Business para sincronizar campanhas, anúncios, lead ads e métricas de vendas."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isConnected ? (
              <>
                <Button size="sm" variant="outline" onClick={handleManualSync} disabled={syncing} className="h-9 px-3 text-xs gap-1.5">
                  <ArrowsClockwise className={`size-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Sincronizando..." : "Sincronizar Agora"}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDisconnect} disabled={loading} className="h-9 px-3 text-xs text-destructive hover:bg-destructive/10 gap-1.5">
                  <Power className="size-4" /> Desconectar
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleLaunchEmbeddedSignup} disabled={loading} className="h-9 px-4 text-xs font-semibold gap-2">
                <Lightning className="size-4" /> Conectar com Meta
              </Button>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <Warning className="size-4 shrink-0" weight="fill" />
            <span>{errorMessage}</span>
          </div>
        )}
      </Card>

      {/* ─── STATUS DOS ATIVOS CONECTADOS ─── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Empresa", status: isConnected ? connection?.businessName || "Conectada" : "Pendente", icon: Globe, color: "text-primary", bg: "bg-primary/10" },
          { label: "Business Manager", status: isConnected ? "Conectado" : "Desconectado", icon: ShieldCheck, color: "text-chart-2", bg: "bg-chart-2/10" },
          { label: "WhatsApp", status: connection?.whatsappConnected ? "Conectado" : "Pendente", icon: Phone, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Lead Ads", status: isConnected ? "Conectado" : "Pendente", icon: UserList, color: "text-chart-3", bg: "bg-chart-3/10" },
          { label: "Campanhas", status: isConnected ? "Sincronizadas" : "Aguardando", icon: Lightning, color: "text-chart-4", bg: "bg-chart-4/10" },
          {
            label: "Última Sincronização",
            status: connection?.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—",
            icon: Clock,
            color: "text-muted-foreground",
            bg: "bg-muted/50",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-border/60 bg-card p-4 text-left shadow-none">
              <div className="flex items-center justify-between gap-2">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${item.bg} ${item.color}`}>
                  <Icon className="size-4" />
                </span>
                <span className="text-[10px] font-mono font-medium text-muted-foreground uppercase">Status</span>
              </div>
              <div className="mt-3 space-y-0.5">
                <p className="text-sm font-bold text-foreground truncate">{item.status}</p>
                <p className="text-xs font-medium text-muted-foreground truncate">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── ATIVOS SELECIONADOS NO EMBEDDED SIGNUP (PRODUTOS) ─── */}
      <Card className="rounded-xl border border-border/70 bg-card shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-bold">Produtos Ativados no Embedded Signup v4</CardTitle>
          <CardDescription className="text-xs">
            A integração ativa e gerencia automaticamente as APIs necessárias para o seu tenant:
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { name: "Cloud API", status: "✅ WhatsApp Business Oficial" },
            { name: "Click To WhatsApp Ads", status: "✅ Rastreio de Anúncio -> Conversa" },
            { name: "Conversions API", status: "✅ Envio Server-Side de Vendas" },
            { name: "Marketing Messages", status: "✅ Notificações & Campanhas" },
            { name: "Automatic Events API", status: "✅ Eventos de Funil do CRM" },
          ].map((prod) => (
            <div key={prod.name} className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <p className="text-xs font-bold text-foreground">{prod.name}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{prod.status}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ─── AUDITORIA DE SINCRONIZAÇÕES (LOGS) ─── */}
      <Card className="rounded-xl border border-border/70 bg-card shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border/50 p-4">
          <div>
            <CardTitle className="text-base font-bold">Logs de Sincronização & Auditoria</CardTitle>
            <CardDescription className="text-xs">Histórico recente de requisições e syncs com a Meta Graph API.</CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {logs.length} registros
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="pl-4 text-xs font-semibold">Tipo</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Itens Sincronizados</TableHead>
                <TableHead className="text-xs font-semibold">Duração</TableHead>
                <TableHead className="text-xs font-semibold">Início</TableHead>
                <TableHead className="pr-4 text-xs font-semibold">Detalhes / Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="pl-4 text-xs font-medium font-mono uppercase">{log.syncType}</TableCell>
                  <TableCell>
                    <Badge variant={log.status === "success" ? "success" : log.status === "error" ? "destructive" : "outline"} className="text-[10px]">
                      {log.status === "success" ? "Sucesso" : log.status === "error" ? "Erro" : "Em andamento"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{log.itemsSynced} itens</TableCell>
                  <TableCell className="text-xs font-mono">{log.durationMs ? `${log.durationMs}ms` : "—"}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(log.startedAt))}
                  </TableCell>
                  <TableCell className="pr-4 text-xs text-muted-foreground max-w-xs truncate">{log.errorDetails || "—"}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="p-6 text-center text-xs text-muted-foreground">
                    Nenhum log de sincronização registrado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de confirmação de ativos */}
      <MetaAssetsModal
        open={assetsModalOpen}
        onOpenChange={setAssetsModalOpen}
        assets={discoveredAssets}
        onConfirm={handleConfirmAssets}
      />
    </div>
  );
}
