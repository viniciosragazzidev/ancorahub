/**
 * Script da splash que roda antes da primeira pintura, injetado
 * no <head> pelo layout raiz com next/script "beforeInteractive":
 * - se a splash já apareceu nesta sessão, marca html[data-splash="done"] e ela nem aparece;
 * - se o aparelho pediu "Menos animação" (ancora:a11y), marca html[data-splash="static"] e a arte fica parada.
 * Texto fixo, sem dado do usuário.
 */
export const SPLASH_KEY = "__ancora_splash_shown";

export const SPLASH_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;if(sessionStorage.getItem("${SPLASH_KEY}")){d.dataset.splash="done";return}var p=JSON.parse(localStorage.getItem("ancora:a11y")||"{}");if(p&&p.reduceMotion)d.dataset.splash="static"}catch(e){}})();`;
