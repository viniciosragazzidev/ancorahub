"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

import { getWhatsAppConnection } from "@/app/(dashboard)/settings/whatsapp-actions";
import { Monitor, WhatsappLogo } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { WhatsAppConnectDialog } from "@/components/whatsapp/whatsapp-connect-dialog";
import { recordWhatsAppPlantaoNoticeAction } from "@/features/whatsapp-plantao-notice/actions";
import tourStyles from "@/components/chat/tour/lite-tour.module.css";
import styles from "./whatsapp-plantao-notice.module.css";

type WhatsAppConnection = Awaited<ReturnType<typeof getWhatsAppConnection>>;
type NoticeMode = "daily" | "sticky";

const DAILY_TITLE = "Conecte seu WhatsApp até 20/10";
const STICKY_TITLE = "Conecte seu WhatsApp até 20/10 para receber os leads do plantão";
const NOTICE_BODY = "Para continuar recebendo os leads do plantão em que você está escalado, seu WhatsApp precisa estar conectado ao CRM. Com as informações dos seus atendimentos, conseguimos melhorar a qualidade dos leads que chegam até você.";
const NOTICE_HIGHLIGHT = "A conexão é feita pelo computador: o CRM mostra um QR code e você lê com o WhatsApp do celular.";
const MOBILE_CONNECT_COPY = "Para conectar, abra o CRM no computador.";

function localDateKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function storageKey(userId: string) {
  return `whatsapp-plantao-notice:${userId}:${localDateKey()}`;
}

export function WhatsAppPlantaoNotice({
  userId,
  mode,
}: {
  userId: string;
  mode: NoticeMode;
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(mode === "sticky");
  const [mobileHelp, setMobileHelp] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<WhatsAppConnection | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [connected, setConnected] = useState(false);
  const [desktopConnectAvailable, setDesktopConnectAvailable] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const update = () => setDesktopConnectAvailable(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (mode === "sticky") return;

    let isMounted = true;
    queueMicrotask(() => {
      if (!isMounted) return;
      try {
        setVisible(localStorage.getItem(storageKey(userId)) !== "closed");
      } catch {
        setVisible(true);
      }
    });

    return () => { isMounted = false; };
  }, [mode, userId]);

  const dailyOpen = mode === "daily" && visible && !connected && pathname !== "/dashboard/c/ancora";
  if (mode === "sticky" && (!visible || connected)) return null;
  if (mode === "daily" && !dailyOpen && !dialogInitial) return null;

  function closeForToday() {
    try {
      localStorage.setItem(storageKey(userId), "closed");
    } catch {
      // Keep the current screen usable when browser storage is unavailable.
    }
    void recordWhatsAppPlantaoNoticeAction("closed").catch((error) => {
      console.error("Não foi possível registrar o fechamento do aviso do plantão.", error);
    });
    setVisible(false);
  }

  async function connect() {
    void recordWhatsAppPlantaoNoticeAction("connect_clicked").catch((error) => {
      console.error("Não foi possível registrar o clique de conexão do WhatsApp.", error);
    });

    const desktop = window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches;
    if (desktop) {
      setConnectionError(false);
      setLoadingConnection(true);
      try {
        setDialogInitial(await getWhatsAppConnection());
        setDialogOpen(true);
      } catch {
        setConnectionError(true);
      } finally {
        setLoadingConnection(false);
      }
      return;
    }
    setMobileHelp(true);
  }

  return (
    <>
      {mode === "daily" ? (
        <Dialog open={dailyOpen} onOpenChange={(open) => { if (!open) closeForToday(); }}>
          <DialogPopup className={`${styles.modalPopup} max-w-[1100px] gap-0 overflow-hidden p-0`} overlayClassName={styles.modalOverlay}>
            <div className={styles.modalLayout}>
              <section className={styles.modalCopy} aria-labelledby="whatsapp-plantao-notice-title">
                <div className={styles.progress} role="img" aria-label="Etapa 1 de 2">
                  <span className={styles.progressActive} />
                  <span />
                </div>
                <DialogTitle id="whatsapp-plantao-notice-title" className={styles.modalTitle}>
                  {DAILY_TITLE}
                </DialogTitle>
                <DialogDescription className={styles.modalDescription}>
                  {NOTICE_BODY}
                </DialogDescription>
                <p className={styles.modalComputerLine}>
                  <Monitor aria-hidden="true" />
                  <span>{desktopConnectAvailable ? NOTICE_HIGHLIGHT : MOBILE_CONNECT_COPY}</span>
                </p>
                {connectionError ? <p role="alert" className={styles.modalError}>Não foi possível abrir a conexão agora. Tente novamente.</p> : null}
                <div className={styles.modalActions}>
                  {desktopConnectAvailable ? (
                    <Button
                      type="button"
                      variant="deep-sapphire"
                      size="lg"
                      onClick={() => void connect()}
                      loading={loadingConnection}
                      disabled={loadingConnection}
                      className={styles.modalPrimary}
                    >
                      Conectar WhatsApp
                    </Button>
                  ) : null}
                  <Button type="button" variant={desktopConnectAvailable ? "outline" : "deep-sapphire"} size="lg" onClick={closeForToday} className={styles.modalSecondary}>
                    {desktopConnectAvailable ? "Agora não" : "Entendi"}
                  </Button>
                </div>
              </section>
              <div className={styles.modalIllustration} aria-hidden="true">
                <div className={styles.illustrationGlow} />
                <span className={`${styles.sparkle} ${styles.sparkleOne}`} />
                <span className={`${styles.sparkle} ${styles.sparkleTwo}`} />
                <div className={styles.phone}>
                  <div className={styles.phoneSide} />
                  <div className={styles.phoneFrame}>
                    <div className={styles.phoneScreen}>
                      <span className={styles.phoneSpeaker} />
                      <div className={styles.phoneAppIcon}><WhatsappLogo /></div>
                      <span className={styles.phoneLine} />
                      <span className={`${styles.phoneLine} ${styles.phoneLineShort}`} />
                    </div>
                  </div>
                </div>
                <div className={styles.pedestal}>
                  <span className={styles.pedestalTop} />
                </div>
              </div>
            </div>
            {dialogInitial ? (
              <WhatsAppConnectDialog
                initial={dialogInitial}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onConnectionChanged={() => {
                  setDialogOpen(false);
                  setConnected(true);
                }}
              />
            ) : null}
          </DialogPopup>
        </Dialog>
      ) : (
        <div className={`${styles.frame} ${styles.stickyFrame}`}>
          <motion.section
            aria-labelledby="whatsapp-plantao-notice-title"
            className={`${tourStyles.card} ${styles.card} ${styles.stickyCard}`}
            style={{ position: "relative", inset: "auto", zIndex: 1, width: "100%" }}
            initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.97, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
          <div className={styles.layout}>
            <div className={styles.brandIcon} aria-hidden="true"><WhatsappLogo size={25} /></div>
            <div className={styles.content}>
              <div className={styles.heading}>
                <h2 id="whatsapp-plantao-notice-title" className={`${tourStyles.title} ${styles.title}`}>
                  {STICKY_TITLE}
                </h2>
              </div>
              <div className={styles.actions}>
                <p role={mobileHelp ? "status" : undefined} className={`${tourStyles.body} ${styles.mobileComputerLine}`}>
                  <Monitor size={18} aria-hidden="true" />
                  <span>{MOBILE_CONNECT_COPY}</span>
                </p>
                {desktopConnectAvailable ? (
                  <Button
                    type="button"
                    variant="deep-sapphire"
                    size="lg"
                    onClick={() => void connect()}
                    loading={loadingConnection}
                    disabled={loadingConnection}
                    className={`${tourStyles.primary} ${styles.connectButton}`}
                  >
                    Conectar
                  </Button>
                ) : null}
              </div>
              {connectionError ? <p role="alert" className={`${tourStyles.body} ${styles.error}`}>Não foi possível abrir a conexão agora. Tente novamente.</p> : null}
            </div>
          </div>
          </motion.section>
        </div>
      )}
      {dialogInitial && mode === "sticky" ? (
        <WhatsAppConnectDialog
          initial={dialogInitial}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onConnectionChanged={() => {
            setDialogOpen(false);
            setConnected(true);
          }}
        />
      ) : null}
    </>
  );
}
