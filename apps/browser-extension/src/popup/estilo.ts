// Tokens do Lite (venancor-scope.css: fundo, superfície, texto, raios; chat.module.css: azul de ação).
// Popup fica fora do WhatsApp, então segue o tema do sistema (claro e escuro).
export const ESTILO = `
:root{--bg:#f7f7f9;--surface:#ffffff;--fg:#0b0b12;--muted:#666674;--border:rgb(16 16 40 / .08);--action:oklch(62% .2 255);--ok:#0f7a4d;--ok-soft:#e6f4ee;--aviso:#a15c00;--aviso-soft:#fbf1e3;--shadow:0 1px 2px rgb(16 16 40 / .04),0 8px 24px rgb(16 16 40 / .05)}
@media (prefers-color-scheme: dark){:root{--bg:oklch(17% 0 0);--surface:oklch(21.5% 0 0);--fg:oklch(96% 0 0);--muted:oklch(72% 0 0);--border:oklch(29% 0 0);--action:oklch(70% .17 255);--ok:oklch(78% .14 160);--ok-soft:oklch(30% .05 160);--aviso:oklch(84% .12 75);--aviso-soft:oklch(30% .05 75);--shadow:none}}
*{box-sizing:border-box}
body{margin:0;width:320px;background:var(--bg);color:var(--fg);font-family:"Inter Variable",Inter,system-ui,sans-serif}
.painel{display:grid;gap:12px;padding:16px}
.topo{display:flex;align-items:center;gap:10px}
.marca{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:var(--action);color:#fff;font-weight:700}
h1{margin:0;font-size:15px;font-weight:600}
.selo{display:inline-block;margin-top:3px;padding:2px 9px;border-radius:999px;background:var(--border);color:var(--muted);font-size:12px}
.selo.ok{background:var(--ok-soft);color:var(--ok)}
.selo.aviso{background:var(--aviso-soft);color:var(--aviso)}
.bloco{display:grid;gap:2px;padding:14px;border-radius:24px;background:var(--surface);box-shadow:var(--shadow)}
.rotulo{margin:0 0 2px;color:var(--muted);font-size:12px}
.valor{margin:0;font-size:16px;font-weight:600}
.texto{margin:0;font-size:14px;line-height:1.5}
.secundario{margin:0;color:var(--muted);font-size:13px;line-height:1.45}
button{font:inherit;cursor:pointer;border:0}
.primario{height:44px;border-radius:999px;background:var(--action);color:#fff;font-size:14px;font-weight:600}
.seco{height:40px;border:1px solid var(--border);border-radius:999px;background:transparent;color:var(--fg);font-size:13px;font-weight:600}
.separador{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px}
.separador::before,.separador::after{content:"";flex:1;height:1px;background:var(--border)}
input{height:40px;padding:0 14px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--fg);font:inherit;font-size:14px}
.status{min-height:1em;margin:0;color:var(--muted);font-size:12px}
:focus-visible{outline:2px solid var(--action);outline-offset:2px}
@media (prefers-reduced-motion: reduce){*{transition:none!important}}
`;
