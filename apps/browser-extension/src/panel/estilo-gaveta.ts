// Coluna de "Dados do lead" no padrão do WhatsApp Web: encostada à direita, altura da área da conversa,
// sem cantos nem sombra, com a divisória fina do WhatsApp. O Lite entra na tipografia, no anel de temperatura
// e na ação primária azul. Cores vêm das variáveis --ct-* que a ponte de tema escreve no host.
export const ESTILO_GAVETA = `
:host{--ct-bg:#ffffff;--ct-fg:#111b21;--ct-muted:#667781;--ct-surface:#f0f2f5;--ct-line:#e9edef;--ct-action:oklch(62% .2 255);--ct-quente:oklch(58% .2 30);--ct-morno:oklch(70% .15 75);--ct-frio:oklch(62% .15 255)}
.gaveta{box-sizing:border-box;width:100%;height:100%;display:flex;flex-direction:column;background:var(--ct-bg);color:var(--ct-fg);font-family:"Inter Variable",Inter,system-ui,sans-serif;font-size:14px;line-height:1.4;overflow:hidden}
.cabeca{display:flex;align-items:center;gap:18px;height:60px;flex:none;padding:0 16px;border-bottom:1px solid var(--ct-line)}
.cabeca strong{font-size:16px;font-weight:600}
.fechar{display:grid;place-items:center;width:32px;height:32px;border:0;border-radius:999px;background:transparent;color:var(--ct-muted);font-size:22px;line-height:1;cursor:pointer}
.corpo{flex:1;overflow:auto;min-height:0}
.identidade{display:flex;flex-direction:column;align-items:center;gap:4px;padding:24px 16px 20px;border-bottom:8px solid var(--ct-surface)}
.identidade strong{margin-top:10px;font-size:18px;font-weight:600;text-align:center}
.identidade span{color:var(--ct-muted);font-size:14px}
.avatar-grande{position:relative;width:112px;height:112px}
.avatar-grande svg{position:absolute;inset:0;width:100%;height:100%}
.avatar-grande circle{fill:none;stroke-width:4}
.avatar-grande .trilho{stroke:var(--ct-line)}
.avatar-grande .arco{transition:stroke-dasharray 320ms ease}
.avatar-grande[data-t="quente"] .arco{stroke:var(--ct-quente)}
.avatar-grande[data-t="morno"] .arco{stroke:var(--ct-morno)}
.avatar-grande[data-t="frio"] .arco{stroke:var(--ct-frio)}
.avatar-grande[data-t="sem-dados"] .arco{stroke:var(--ct-muted)}
.identidade .iniciais{position:absolute;inset:10px;display:grid;place-items:center;border-radius:999px;background:var(--ct-surface);color:var(--ct-fg);font-size:26px;font-weight:600}
.secao{padding:14px 16px;border-bottom:1px solid var(--ct-line)}
.secao h2,.rotulo{margin:0 0 4px;color:var(--ct-muted);font-size:12px;font-weight:500}
.secao p{margin:0}
.valor{font-size:14px}
.campos{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px;margin:0}
.campo{min-width:0}
.campo dd{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.campo dt{margin:0 0 2px;color:var(--ct-muted);font-size:12px}
.secao ul{margin:0;padding:0;list-style:none;display:grid;gap:8px}
.secao li{display:flex;justify-content:space-between;gap:8px}
.secao time,.dica,.muted{color:var(--ct-muted);font-size:12px}
.acoes{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.bloco-acoes{display:grid;gap:0}
.campo-acao{display:grid;gap:6px;margin-top:12px}
.campo-acao .rotulo{margin:0}
.campo-acao select,.campo-acao textarea,.campo-acao input{box-sizing:border-box;width:100%;padding:8px 10px;border:1px solid var(--ct-line);border-radius:12px;background:var(--ct-bg);color:var(--ct-fg);font:inherit;font-size:13px}
.campo-acao textarea{min-height:72px;resize:vertical}
.campo-acao .seco{justify-self:start}
.aviso-ok,.aviso-erro{margin:10px 0 0;font-size:12px}
.aviso-ok{color:var(--ct-muted)}
.aviso-erro{color:var(--ct-quente)}
button{font:inherit;cursor:pointer}
.seco{height:32px;padding:0 14px;border:1px solid var(--ct-line);border-radius:999px;background:transparent;color:var(--ct-fg);font-size:13px;font-weight:500}
.primario{height:40px;border:0;border-radius:999px;background:var(--ct-action);color:#fff;font-size:14px;font-weight:600}
button:disabled{opacity:.55;cursor:default}
.rodape{display:grid;gap:8px;padding:16px}
.sugestoes{display:grid;gap:6px;margin-top:10px}
.sugestao{padding:9px 12px;border:0;border-radius:12px;background:var(--ct-surface);color:var(--ct-fg);text-align:left;font-size:13px}
.aviso{margin:0;padding:16px;color:var(--ct-muted)}
.bloco-aviso{display:grid;gap:12px;padding:16px}
.esqueleto{height:112px;margin:16px;border-radius:999px;background:linear-gradient(90deg,var(--ct-surface),var(--ct-line),var(--ct-surface));background-size:200% 100%;animation:pulsar 1.4s ease-in-out infinite}
@keyframes pulsar{0%{background-position:100% 0}100%{background-position:-100% 0}}
:focus-visible{outline:2px solid var(--ct-action);outline-offset:2px}
@media (prefers-reduced-motion: reduce){.avatar-grande .arco{transition:none}.esqueleto{animation:none}}
`;
