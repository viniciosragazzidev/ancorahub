// Gaveta no Lite do corretor. Cores e raios vêm dos tokens do painel (venancor-scope) e das variáveis --ct-*
// que a ponte de tema escreve no host (claro e escuro do WhatsApp). Movimento respeita reduced motion.
export const ESTILO_GAVETA = `
:host{--ct-bg:#ffffff;--ct-fg:#0b0b12;--ct-muted:#666674;--ct-surface:#f7f7f9;--ct-line:rgb(16 16 40 / .08);--ct-action:oklch(62% .2 255);--ct-quente:oklch(58% .2 30);--ct-morno:oklch(70% .15 75);--ct-frio:oklch(62% .15 255)}
.gaveta{box-sizing:border-box;width:min(344px,calc(100vw - 32px));max-height:calc(100vh - 96px);display:flex;flex-direction:column;overflow:hidden;border-radius:24px;background:var(--ct-bg);color:var(--ct-fg);box-shadow:0 16px 40px rgb(16 16 40 / .14);font-family:"Inter Variable",Inter,system-ui,sans-serif;font-size:13px;line-height:1.45;transition:opacity 260ms ease,transform 260ms ease}
.cabeca{display:flex;align-items:center;gap:10px;padding:14px 14px 10px;border-bottom:1px solid var(--ct-line)}
.marca,.avatar{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:var(--ct-action);color:#fff;font-weight:700;flex:none}
.titulo{display:grid;min-width:0;flex:1}
.titulo strong{font-size:14px}
.titulo span,.rotulo,.dica,.muted{color:var(--ct-muted);font-size:12px}
.fechar{width:30px;height:30px;border:0;border-radius:999px;background:transparent;color:var(--ct-muted);font-size:18px;cursor:pointer}
.corpo{display:grid;gap:10px;padding:12px 14px 14px;overflow:auto}
.identidade{display:flex;align-items:center;gap:10px}
.identidade strong{display:block;font-size:15px}
.identidade span{color:var(--ct-muted);font-size:12px}
.identidade .avatar{color:#fff;font-size:12px}
.temperatura{display:flex;align-items:center;gap:12px;padding:12px;border-radius:18px;background:var(--ct-surface)}
.temperatura strong{display:block;font-size:15px}
.anel{width:56px;height:56px;flex:none}
.anel circle{fill:none;stroke-width:6}
.anel .trilho{stroke:var(--ct-line)}
.anel .arco{transition:stroke-dasharray 320ms ease}
.anel[data-t="quente"] .arco{stroke:var(--ct-quente)}
.anel[data-t="morno"] .arco{stroke:var(--ct-morno)}
.anel[data-t="frio"] .arco{stroke:var(--ct-frio)}
.anel[data-t="sem-dados"] .arco{stroke:var(--ct-muted)}
.grade{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0}
.grade div{padding:9px 10px;border-radius:14px;background:var(--ct-surface);min-width:0}
.grade dt{color:var(--ct-muted);font-size:11px}
.grade dd{margin:2px 0 0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bloco{padding:10px 12px;border-radius:18px;background:var(--ct-surface)}
.bloco h2{margin:0 0 4px;font-size:12px;font-weight:600;color:var(--ct-muted)}
.bloco p,.bloco li{margin:0}
.bloco ul{margin:0;padding:0;list-style:none;display:grid;gap:4px}
.bloco li{display:flex;justify-content:space-between;gap:8px;color:var(--ct-fg)}
.bloco time{color:var(--ct-muted)}
.acoes{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
button{font:inherit;cursor:pointer}
.seco{height:34px;padding:0 12px;border:1px solid var(--ct-line);border-radius:999px;background:var(--ct-bg);color:var(--ct-fg);font-size:12px;font-weight:600}
.primario{height:42px;border:0;border-radius:999px;background:var(--ct-action);color:#fff;font-size:14px;font-weight:600}
button:disabled{opacity:.55;cursor:default}
.sugestoes{display:grid;gap:6px;margin-top:8px}
.sugestao{padding:8px 10px;border:0;border-radius:14px;background:var(--ct-bg);color:var(--ct-fg);text-align:left;font-size:12px}
.aviso{color:var(--ct-muted)}
.esqueleto{height:56px;border-radius:18px;background:linear-gradient(90deg,var(--ct-surface),var(--ct-line),var(--ct-surface));background-size:200% 100%;animation:pulsar 1.4s ease-in-out infinite}
@keyframes pulsar{0%{background-position:100% 0}100%{background-position:-100% 0}}
:focus-visible{outline:2px solid var(--ct-action);outline-offset:2px}
@media (prefers-reduced-motion: reduce){.gaveta,.anel .arco{transition:none}.esqueleto{animation:none}}
`;
