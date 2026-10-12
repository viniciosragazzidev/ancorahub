"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";

import styles from "./chat.module.css";

type Phase = "starting" | "live" | "shot" | "failed";

/** True when the browser can show the camera inside the page (no switch to the camera app). */
export function canUseInPageCamera() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/**
 * Camera inside the app: the rear camera streams into the page and one tap takes
 * the photo. On low-memory Android phones the system camera app makes the
 * browser close ("insuficiência de memória"); staying in the page avoids it.
 * When the camera cannot open here, onFallback hands over to the system picker.
 */
export function CameraCapture({ onShot, onClose, onFallback }: { onShot: (photo: Blob) => void; onClose: () => void; onFallback: () => void }) {
  const reduce = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1600 }, height: { ideal: 1200 } }, audio: false })
      .then((media) => {
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play().catch(() => undefined);
        }
        setPhase("live");
      })
      .catch(() => { if (!cancelled) setPhase("failed"); });
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, []);

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  // Esc closes, like the other dialogs of the app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function take() {
    const element = video.current;
    if (!element || !element.videoWidth) return;
    const scale = Math.min(1, 1600 / Math.max(element.videoWidth, element.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(element.videoWidth * scale);
    canvas.height = Math.round(element.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(element, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setShot({ blob, url: URL.createObjectURL(blob) });
      setPhase("shot");
      if ("vibrate" in navigator) navigator.vibrate?.(20);
    }, "image/jpeg", 0.82);
  }

  function retake() {
    setShot(null);
    setPhase("live");
    void video.current?.play().catch(() => undefined);
  }

  function use() {
    if (!shot) return;
    stream.current?.getTracks().forEach((track) => track.stop());
    onShot(shot.blob);
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <motion.div
      className={styles.camera}
      role="dialog"
      aria-modal="true"
      aria-label="Tirar foto do local"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <video ref={video} className={styles.cameraVideo} data-hidden={phase === "shot"} playsInline muted autoPlay />
      {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the photo just taken */}
      {shot ? <img src={shot.url} alt="Foto do local" className={styles.cameraVideo} /> : null}
      {phase === "starting" ? <p className={styles.cameraHint}>Abrindo a câmera…</p> : null}
      {phase === "failed" ? (
        <div className={styles.cameraFailed}>
          <p>Não deu para abrir a câmera aqui. Libere a câmera para o app ou use a câmera do celular.</p>
          <button type="button" className={styles.cameraPrimary} onClick={onFallback}>Usar a câmera do celular</button>
        </div>
      ) : null}
      {phase === "live" ? <p className={styles.cameraHint}>Mostre o local da unidade</p> : null}

      <div className={styles.cameraBar}>
        <button type="button" className={styles.cameraGhost} onClick={phase === "shot" ? retake : onClose}>{phase === "shot" ? "Tirar de novo" : "Cancelar"}</button>
        {phase === "shot" ? (
          <motion.button type="button" className={styles.cameraPrimary} onClick={use} whileTap={reduce ? undefined : { scale: 0.96 }}>Enviar foto</motion.button>
        ) : (
          <motion.button type="button" className={styles.cameraShutter} onClick={take} disabled={phase !== "live"} aria-label="Tirar a foto" whileTap={reduce ? undefined : { scale: 0.9 }} />
        )}
        <span className={styles.cameraSpacer} aria-hidden="true" />
      </div>
    </motion.div>,
    document.body,
  );
}
