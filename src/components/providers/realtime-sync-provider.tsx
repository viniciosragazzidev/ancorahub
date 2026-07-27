"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createClient } from "@/utils/supabase/client";

interface RealtimeSyncProviderProps {
  children: React.ReactNode;
  tenantId: string;
  userId: string;
  role: string;
  branchId: string | null;
}

interface LeadRow {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  corretor_id: string | null;
  nome: string;
  status: string;
}

interface NotificationRow {
  id: string;
  tenant_id: string;
  recipient_user_id: string;
  lead_id: string | null;
  type: string;
  title: string;
  message: string;
}

export function RealtimeSyncProvider({ children, tenantId, userId, role, branchId }: RealtimeSyncProviderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const playSoundRef = useRef<((cue: any) => void) | null>(null);
  const seenLeadIdsRef = useRef<Set<string>>(new Set());
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  /** Se o usuário está digitando em um campo de formulário, pula o refresh */
  const isFormElementFocused = useCallback(() => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      (el as HTMLElement)?.isContentEditable ||
      el.getAttribute("role") === "textbox" ||
      el.closest('[role="dialog"]') !== null
    );
  }, []);

  const syncClientState = useCallback((reason: string, broadcast = true) => {
    void queryClient.invalidateQueries({ queryKey: ["local-first", tenantId, userId] });
    setLastSyncedAt(Date.now());
    if (broadcast) broadcastRef.current?.postMessage({ type: "local-first.invalidate", reason });
  }, [queryClient, tenantId, userId]);

  useEffect(() => {
    // Only track online status change without triggering full page refresh
    const handleOnline = () => { setIsOnline(true); };
    const handleOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const notifyNewLead = useCallback((lead: LeadRow) => {
    const isAssignedToMe = lead.corretor_id === userId;
    const isInMyBranch = lead.branch_id === branchId;
    const isUnassigned = !lead.corretor_id;
    const hasNoBranch = !lead.branch_id;
    const canNotify = isAssignedToMe || isUnassigned || hasNoBranch || role === "director" || (role === "manager" && isInMyBranch);
    if (!canNotify) return;
    playSoundRef.current?.("success");
    const description = isAssignedToMe
      ? `O lead "${lead.nome}" foi distribuído para você.`
      : isUnassigned && hasNoBranch
        ? `"${lead.nome}" chegou sem filial e está aguardando distribuição.`
        : isUnassigned
          ? `"${lead.nome}" chegou na sua unidade e está aguardando distribuição.`
          : `Novo lead "${lead.nome}" foi adicionado.`;
    toast.success("Novo lead recebido!", {
      description,
      action: { label: "Abrir", onClick: () => router.push(`/leads/${lead.id}`) },
      duration: 10_000,
    });
  }, [userId, branchId, role, router]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`public:tenant:${tenantId}:user:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        const newRow = payload.new as LeadRow | null;
        const oldRow = payload.old as Partial<LeadRow> | null;
        if (payload.eventType === "INSERT" && newRow) {
          if (!seenLeadIdsRef.current.has(newRow.id)) {
            seenLeadIdsRef.current.add(newRow.id);
            notifyNewLead(newRow);
          }
          syncClientState("lead.insert");
        }
        if (payload.eventType === "UPDATE" && newRow && (role === "director" || (role === "manager" && (newRow.branch_id === branchId || oldRow?.branch_id === branchId)) || (role === "broker" && (newRow.corretor_id === userId || oldRow?.corretor_id === userId || newRow.branch_id === branchId || oldRow?.branch_id === branchId)))) syncClientState("lead.update");
        if (payload.eventType === "DELETE" && oldRow && (role === "director" || (role === "manager" && oldRow.branch_id === branchId) || (role === "broker" && (oldRow.corretor_id === userId || oldRow.branch_id === branchId)))) syncClientState("lead.delete");
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${userId}` }, (payload) => {
        const notification = payload.new as NotificationRow | null;
        if (!notification || notification.tenant_id !== tenantId) return;
        playSoundRef.current?.("success");
        toast.success(notification.title, { description: notification.message, action: notification.lead_id ? { label: "Abrir", onClick: () => router.push(`/leads/${notification.lead_id}`) } : undefined });
        syncClientState("notification.insert");
      })
      // Server components are refreshed as a fallback even when a screen has
      // no React Query hook yet. This keeps every tenant-scoped surface live.
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_documents", filter: `tenant_id=eq.${tenantId}` }, () => syncClientState("documents"))
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_tasks", filter: `tenant_id=eq.${tenantId}` }, () => syncClientState("tasks"))
      .on("postgres_changes", { event: "*", schema: "public", table: "clients", filter: `tenant_id=eq.${tenantId}` }, () => syncClientState("clients"))
      .on("postgres_changes", { event: "*", schema: "public", table: "sales", filter: `tenant_id=eq.${tenantId}` }, () => syncClientState("sales"))
      .on("postgres_changes", { event: "*", schema: "public", table: "tenant_memberships", filter: `tenant_id=eq.${tenantId}` }, () => syncClientState("team"))
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setIsOnline(false);
          console.error("Falha ao assinar atualizações em tempo real.", error);
        }
        if (status === "SUBSCRIBED") {
          setIsOnline(true);
          setLastSyncedAt(Date.now());
        }
      });
    return () => { void supabase.removeChannel(channel); };
  }, [tenantId, userId, role, branchId, router, notifyNewLead, syncClientState]);

  return (
    <>
      {!isOnline ? <div role="status" className="fixed inset-x-0 bottom-3 z-[70] mx-auto w-fit rounded-full border border-warning/30 bg-card px-3 py-1.5 text-xs text-warning shadow-lg">Conexão perdida · as alterações serão sincronizadas assim que voltar</div> : null}
      <div data-local-first-sync={lastSyncedAt ? new Date(lastSyncedAt).toISOString() : undefined}>{children}</div>
    </>
  );
}
