"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";

import { Bell, BellRinging, CheckCircle } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getSubscriptionStatusAction,
  sendTestNotificationAction,
  subscribeUserAction,
  unsubscribeUserAction,
} from "../push-actions";
import { getPushAvailability } from "../push-availability";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const rawData = window.atob((base64String + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(rawData, (character) => character.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

type PushNotificationManagerProps = {
  variant?: "card" | "compact";
  onSubscribed?: () => void;
};

export function PushNotificationManager({
  variant = "card",
  onSubscribed,
}: PushNotificationManagerProps) {
  const reduceMotion = useReducedMotion();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  const checkSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const [status, browserSubscription] = await Promise.all([
        getSubscriptionStatusAction(),
        registration.pushManager.getSubscription(),
      ]);
      setIsSubscribed(Boolean(browserSubscription));
      setSubscriptionCount(status.count);
      setPermission(Notification.permission);
    } catch {
      toast.error("Não foi possível verificar o status das notificações.");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const timeout = window.setTimeout(() => {
      if (supported) void checkSubscription();
      else setChecking(false);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [checkSubscription]);

  const subscribe = async () => {
    const availability = getPushAvailability({
      hasNotificationApi: "Notification" in window,
      hasPushManager: "PushManager" in window,
      hasServiceWorker: "serviceWorker" in navigator,
      permission: "Notification" in window ? Notification.permission : "unsupported",
      hasVapidPublicKey: Boolean(vapidPublicKey),
    });
    if (availability === "unsupported") return;
    setLoading(true);
    try {
      if (availability === "blocked") {
        setPermission("denied");
        toast.error("As notificações estão bloqueadas neste navegador.", {
          description: "Libere a permissão nas configurações do navegador para ativá-las.",
        });
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidKey = vapidPublicKey;
      if (!vapidKey) {
        toast.error("Notificações push não estão disponíveis nesta instalação.");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(vapidKey),
      });
      const result = await subscribeUserAction(JSON.parse(JSON.stringify(subscription)));
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível ativar as notificações.");
        return;
      }

      setIsSubscribed(true);
      setSubscriptionCount(1);
      setPermission(Notification.permission);
      onSubscribed?.();
      toast.success("Notificações ativadas", {
        description: "Você receberá alertas mesmo com o CorreTop fechado.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ativar as notificações.");
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await unsubscribeUserAction(subscription.endpoint);
      }
      setIsSubscribed(false);
      setSubscriptionCount(0);
      setShowControls(false);
      toast.success("Notificações desativadas");
    } catch {
      toast.error("Não foi possível desativar as notificações.");
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    if (!message.trim()) {
      toast.error("Digite uma mensagem para o teste.");
      return;
    }
    setLoading(true);
    try {
      const result = await sendTestNotificationAction(message);
      if (!result.success) {
        toast.error(result.error ?? "Falha ao enviar a notificação.");
        return;
      }
      setMessage("");
      toast.success("Notificação enviada", { description: `${result.sent} dispositivo(s) notificado(s).` });
    } catch {
      toast.error("Erro ao enviar a notificação de teste.");
    } finally {
      setLoading(false);
    }
  };

  const availability = getPushAvailability({
    hasNotificationApi: typeof window !== "undefined" && "Notification" in window,
    hasPushManager: typeof window !== "undefined" && "PushManager" in window,
    hasServiceWorker: typeof window !== "undefined" && "serviceWorker" in navigator,
    permission,
    hasVapidPublicKey: Boolean(vapidPublicKey),
  });
  const isSupported = availability !== "unsupported";

  if (variant === "compact") {
    if (checking) return null;

    const isBlocked = availability === "blocked";
    const showBanner = isSupported && !isSubscribed;

    return (
      <motion.div
        layout
        className="overflow-hidden"
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {showBanner && (
          <div className="mx-4 my-3 flex items-center gap-3 rounded-lg border border-border/80 bg-card px-3 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <BellRinging className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">
                {isBlocked ? "Alertas bloqueados neste navegador" : "Não perca o próximo alerta"}
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                {isBlocked
                  ? "Libere as notificações nas configurações do navegador para receber novos leads e tarefas."
                  : "Ative agora para receber novos leads e tarefas mesmo com o sistema fechado."}
              </p>
            </div>
            {!isBlocked && (
              <Button size="xs" onClick={() => void subscribe()} disabled={loading} className="shrink-0 gap-1.5">
                <BellRinging className="size-3" />
                {loading ? "Ativando" : "Ativar"}
              </Button>
            )}
          </div>
        )}
      </motion.div>
    );
  }

  if (checking) {
    return (
      <Card className="border-border/80 bg-card shadow-none">
        <CardContent className="flex items-center gap-3 p-4">
          <span className="size-8 animate-pulse rounded-lg bg-muted" aria-hidden="true" />
          <div className="space-y-1.5"><div className="h-3 w-32 animate-pulse rounded bg-muted" /><div className="h-2.5 w-48 animate-pulse rounded bg-muted/70" /></div>
        </CardContent>
      </Card>
    );
  }

  if (!isSupported) {
    return (
      <Card className="border-border/80 bg-card shadow-none">
        <CardContent className="space-y-2 p-4 text-center">
          <Bell className="mx-auto size-7 text-muted-foreground/50" />
          <p className="text-sm font-medium">Push indisponível neste navegador</p>
          <p className="text-xs leading-5 text-muted-foreground">Use Chrome, Edge ou Safari 16.4 ou superior para receber alertas fora do app.</p>
        </CardContent>
      </Card>
    );
  }

  if (availability === "blocked") {
    return (
      <Card className="border-warning/30 bg-warning/[0.035] shadow-none">
        <CardContent className="space-y-2 p-4 text-center">
          <Bell className="mx-auto size-7 text-warning" />
          <p className="text-sm font-medium">Notificações bloqueadas neste navegador</p>
          <p className="text-xs leading-5 text-muted-foreground">Abra as configurações do site no navegador, permita as notificações para o CorreTop e atualize esta página.</p>
        </CardContent>
      </Card>
    );
  }

  if (availability === "missing_configuration") {
    return (
      <Card className="border-border/80 bg-card shadow-none">
        <CardContent className="space-y-2 p-4 text-center">
          <Bell className="mx-auto size-7 text-muted-foreground/50" />
          <p className="text-sm font-medium">Push temporariamente indisponível</p>
          <p className="text-xs leading-5 text-muted-foreground">Tente novamente em alguns minutos ou fale com o suporte.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
      <Card className="border-border/80 bg-card shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={isSubscribed ? "grid size-8 shrink-0 place-items-center rounded-lg bg-success/10 text-success" : "grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"}>
                {isSubscribed ? <BellRinging className="size-4" weight="fill" /> : <Bell className="size-4" />}
              </span>
              <div className="min-w-0"><CardTitle className="text-sm">Notificações push</CardTitle><CardDescription className="mt-0.5 text-xs">{isSubscribed ? `Ativo em ${subscriptionCount} ${subscriptionCount === 1 ? "dispositivo" : "dispositivos"}` : "Receba alertas mesmo com o CorreTop fechado."}</CardDescription></div>
            </div>
            <Badge variant={isSubscribed ? "success" : "outline"} className="shrink-0 rounded-md text-[10px]">{isSubscribed ? "Ativo" : "Inativo"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isSubscribed ? (
            <>
              <div className="flex gap-2 rounded-lg border border-success/20 bg-success/[0.03] px-3 py-2"><CheckCircle className="mt-0.5 size-4 shrink-0 text-success" weight="fill" /><p className="text-xs leading-5 text-muted-foreground">Novos leads, tarefas e mensagens podem chegar mesmo fora do sistema.</p></div>
              <Button size="sm" variant="outline" onClick={() => setShowControls((current) => !current)} className="w-full">{showControls ? "Ocultar opções" : "Gerenciar notificações"}</Button>
              <AnimatePresence initial={false}>
                {showControls && (
                  <motion.div
                    key="controls"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 border-t border-border/70 pt-3">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Mensagem para teste"
                          value={message}
                          onChange={(event) => setMessage(event.target.value)}
                          className="h-8 flex-1 text-xs"
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void sendTestNotification();
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void sendTestNotification()}
                          disabled={loading || !message.trim()}
                        >
                          {loading ? "Enviando..." : "Testar"}
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void unsubscribe()}
                        disabled={loading}
                        className="w-full"
                      >
                        {loading ? "Desativando..." : "Desativar notificações"}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <><p className="text-xs leading-5 text-muted-foreground">Ative para receber avisos de novos leads, tarefas urgentes e atualizações importantes em tempo real.</p><Button size="sm" onClick={() => void subscribe()} disabled={loading} className="w-full gap-1.5">{loading ? "Ativando..." : <><BellRinging className="size-3.5" />Ativar notificações</>}</Button></>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
