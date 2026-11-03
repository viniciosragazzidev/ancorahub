import { useEffect, useState } from "react";
import type { AvisoInboxExtensao } from "../shared/types";

type TextoAviso = { titulo: string; mensagem: string; acao: string };
const textos: Record<AvisoInboxExtensao["tipo"], TextoAviso> = {
  offer: { titulo: "Nova oferta", mensagem: "Um lead aguarda sua resposta.", acao: "Ver oferta" },
  "last-minute": { titulo: "Oferta perto do vencimento", mensagem: "Uma oferta vence em menos de 1 minuto.", acao: "Revisar oferta" },
  update: { titulo: "Atualização do CRM", mensagem: "Há uma novidade para você.", acao: "Abrir CRM" },
};

export function AvisoInbox({ aviso, onAbrir, onFechar }: { aviso: AvisoInboxExtensao | null; onAbrir(aviso: AvisoInboxExtensao): void; onFechar(): void }) {
  const [descansando, setDescansando] = useState(false);
  useEffect(() => {
    if (!aviso) { setDescansando(false); return; }
    setDescansando(false);
    const timeout = window.setTimeout(() => setDescansando(true), 6000);
    return () => window.clearTimeout(timeout);
  }, [aviso?.id]);
  if (!aviso) return null;
  const texto = textos[aviso.tipo];
  const urgente = aviso.tipo !== "update";
  return (
    <div className="aviso-inbox-layer">
      {descansando ? (
        <div className="aviso-inbox-pill">
          <button className="aviso-inbox-pill-abrir" type="button" aria-label={`${texto.titulo}. Abrir aviso`} onClick={() => setDescansando(false)}>
            <span className="aviso-inbox-ponto" aria-hidden="true" />
            <span>{aviso.tipo === "offer" ? "Nova oferta" : aviso.tipo === "last-minute" ? "Oferta perto do vencimento" : "Atualização do CRM"}</span>
            <span className="aviso-inbox-pill-acao">Abrir</span>
          </button>
          <button className="aviso-inbox-pill-fechar" type="button" aria-label="Fechar aviso" onClick={onFechar}>×</button>
        </div>
      ) : <section className="aviso-inbox" data-tipo={aviso.tipo} role={urgente ? "alert" : "status"} aria-live={urgente ? "assertive" : "polite"} aria-label={`${texto.titulo}. ${texto.mensagem}`}>
        <div className="aviso-inbox-copy">
          <span className="aviso-inbox-app">AncoraHub Assistant</span>
          <strong>{texto.titulo}</strong>
          <span>{texto.mensagem}</span>
        </div>
        <button className="aviso-inbox-acao" type="button" onClick={() => onAbrir(aviso)}>{texto.acao}</button>
        <button className="aviso-inbox-fechar" type="button" aria-label="Fechar aviso" onClick={onFechar}>×</button>
      </section>}
      <style>{`
        .aviso-inbox-layer{position:fixed;inset:8px 8px auto;z-index:2147483647;display:flex;justify-content:center;pointer-events:none}
        .aviso-inbox{pointer-events:auto;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto 30px;align-items:center;gap:12px;width:min(420px,100%);padding:14px;border:1px solid rgb(255 255 255 / .08);border-radius:24px;background:oklch(18% .01 260);color:oklch(98% 0 0);box-shadow:0 18px 40px -12px rgb(0 0 0 / .5);animation:ancora-notice-in 240ms ease-out}
        .aviso-inbox-copy{display:grid;gap:3px;min-width:0}.aviso-inbox-app{color:oklch(78% .01 260);font-size:11px}.aviso-inbox-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:600}.aviso-inbox-copy>span:last-child{color:oklch(88% .01 260);font-size:13px;line-height:1.3}
        .aviso-inbox-acao{min-height:40px;padding:0 13px;border:0;border-radius:999px;background:oklch(62% .2 255);color:white;font:600 13px/1 Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap}
        .aviso-inbox-fechar{width:30px;height:30px;border:0;border-radius:999px;background:transparent;color:oklch(82% .01 260);font:22px/1 Inter,system-ui,sans-serif;cursor:pointer}
        .aviso-inbox-pill{pointer-events:auto;display:flex;align-items:center;gap:5px;min-height:40px;padding:0 7px 0 13px;border:1px solid rgb(255 255 255 / .08);border-radius:999px;background:oklch(18% .01 260);color:oklch(98% 0 0);box-shadow:0 10px 24px rgb(0 0 0 / .35)}
        .aviso-inbox-pill-abrir{display:flex;align-items:center;gap:9px;min-height:38px;padding:0;border:0;background:transparent;color:inherit;font:500 12px/1 Inter,system-ui,sans-serif;cursor:pointer}.aviso-inbox-ponto{width:8px;height:8px;border-radius:999px;background:oklch(70% .17 255)}.aviso-inbox-pill-acao{color:oklch(78% .09 255);font-weight:600}.aviso-inbox-pill-fechar{display:grid;place-items:center;width:24px;height:24px;border:0;border-radius:999px;background:transparent;color:oklch(82% .01 260);font:18px/1 Inter,system-ui,sans-serif;cursor:pointer}
        .aviso-inbox button:focus-visible{outline:2px solid white;outline-offset:3px}.aviso-inbox button:active{transform:scale(.97)}
        @keyframes ancora-notice-in{from{opacity:0;transform:translateY(-10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @media(max-width:420px){.aviso-inbox{grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:12px;border-radius:20px}.aviso-inbox-fechar{position:absolute;top:4px;right:4px;width:24px;height:24px}.aviso-inbox-acao{min-height:38px;padding:0 10px;font-size:12px}}
        @media(prefers-reduced-motion:reduce){.aviso-inbox{animation:none}.aviso-inbox button:active{transform:none}}
      `}</style>
    </div>
  );
}
