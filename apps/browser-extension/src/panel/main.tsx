import { createRoot, type Root } from "react-dom/client";
import tokensAtivos from "../../../../src/components/arc/venancor-scope.css";
import tokensBase from "../../../../src/components/arc/foundation.css";

// Os tokens do Arc declaram :root, que não existe dentro de um shadow root. Viram :host.
const noShadow = (css: string) => css.replaceAll(":root", ":host");

/** Esqueleto do painel novo. A interface completa chega na E2; aqui só a base que monta no shadow root. */
function PainelBase() {
  return (
    <aside aria-label="AncoraHub Assistant" className="arc-venancor">
      <header>
        <strong>AncoraHub Assistant</strong>
      </header>
    </aside>
  );
}

export function montarPainel(shadow: ShadowRoot): Root {
  const estilo = document.createElement("style");
  estilo.textContent = `${noShadow(tokensBase)}\n${tokensAtivos}`;
  const ponto = document.createElement("div");
  shadow.append(estilo, ponto);
  const raiz = createRoot(ponto);
  raiz.render(<PainelBase />);
  return raiz;
}

// O build em IIFE expõe a API para o script de conteúdo; sem isso o bundle seria descartado.
(globalThis as unknown as { AncoraHubPainel: { montarPainel: typeof montarPainel } }).AncoraHubPainel = { montarPainel };
