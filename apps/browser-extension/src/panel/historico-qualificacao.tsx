import { useState } from "react";

/** Mensagem da conversa de qualificação (número da empresa). Só texto, direção e horário. */
export type MensagemQualificacao = { de: "cliente" | "qualificacao"; texto: string; horario: string };
export type DadosHistorico = { total: number; mensagens: MensagemQualificacao[] };

export const ESTILO_HISTORICO = `
:host{--ct-bg:#ffffff;--ct-fg:#111b21;--ct-muted:#667781;--ct-surface:#f0f2f5;--ct-line:#e9edef;--ct-action:oklch(62% .2 255)}
.historico{position:relative;box-sizing:border-box;width:100%;border-bottom:1px solid var(--ct-line);background:var(--ct-bg);color:var(--ct-fg);font:400 13px/1.4 "Inter Variable",Inter,system-ui,sans-serif}
.cabeca{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;height:36px;padding:0 16px;border:0;background:transparent;color:var(--ct-fg);font:600 12px/1 "Inter Variable",Inter,system-ui,sans-serif;cursor:pointer}
.cabeca:focus-visible{outline:2px solid var(--ct-action);outline-offset:-2px}
.rotulo{color:var(--ct-muted);font-weight:400;font-size:11px;white-space:nowrap}
.bolhas{position:absolute;top:100%;left:0;right:0;z-index:5;box-shadow:0 8px 20px rgba(11,20,26,.18);display:flex;flex-direction:column;gap:6px;max-height:min(360px,55vh);overflow-y:auto;overscroll-behavior:contain;margin:0;padding:8px 12px 12px;list-style:none;background:var(--ct-surface)}
.bolha{max-width:78%;padding:6px 9px;border-radius:8px;background:var(--ct-bg);box-shadow:none}
.bolha.qualificacao{align-self:flex-end;background:color-mix(in srgb, var(--ct-action) 16%, var(--ct-bg))}
.bolha.cliente{align-self:flex-start}
.bolha p{margin:0;white-space:pre-wrap;word-break:break-word}
.bolha time{display:block;margin-top:2px;color:var(--ct-muted);font-size:10px;text-align:right}
.vazio{color:var(--ct-muted);text-align:center;font-size:12px}
@media (prefers-reduced-motion: reduce){.historico *{transition:none}}
`;

function horaCurta(iso: string) {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "" : data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Recolhido por padrão. Não é desta conversa: a origem fica explícita no rótulo. */
export function HistoricoQualificacao({ historico }: { historico: DadosHistorico }) {
  const [aberto, setAberto] = useState(false);
  return (
    <section className="historico" aria-label="Conversa com a qualificação, não desta conversa">
      <button className="cabeca" type="button" aria-expanded={aberto} onClick={() => setAberto((atual) => !atual)}>
        <span>Ver conversa da qualificação ({historico.total} mensagens)</span>
        <span className="rotulo">Número da empresa · não é desta conversa</span>
      </button>
      {aberto ? (
        <ol className="bolhas">
          {historico.mensagens.length === 0 ? <li className="vazio">Ainda não há mensagens da qualificação.</li> : null}
          {historico.mensagens.map((mensagem, indice) => (
            <li key={`${mensagem.horario}-${indice}`} className={`bolha ${mensagem.de}`} data-de={mensagem.de}>
              <p>{mensagem.texto}</p>
              <time dateTime={mensagem.horario}>{horaCurta(mensagem.horario)}</time>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
