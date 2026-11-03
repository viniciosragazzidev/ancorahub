// Aviso discreto no WhatsApp Web quando a extensão não tem sessão. Vive num shadow root fechado para não herdar o CSS do WhatsApp.

const ID = "ancorahub-aviso-conexao";

const ESTILO = `:host{position:fixed;left:16px;bottom:16px;z-index:2147483645;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.aviso{display:flex;align-items:center;gap:10px;max-width:320px;padding:10px 12px;border:1px solid #e4e8eb;border-radius:10px;background:#fff;color:#25323a;box-shadow:0 6px 18px rgba(11,20,26,.18);font-size:12px;line-height:1.35}
button{border:0;border-radius:8px;padding:6px 10px;background:#176b5d;color:#fff;font:inherit;font-weight:700;cursor:pointer}
button:focus-visible{outline:2px solid #176b5d;outline-offset:2px}`;

export function mostrarAvisoConexao(onConectar: () => void): () => void {
  if (document.getElementById(ID)) return () => undefined;
  const host = document.createElement("div");
  host.id = ID;
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `<style>${ESTILO}</style><div class="aviso" role="status"><span>Conecte o AncoraHub Assistant ao CRM para ver o contexto do lead.</span><button type="button">Conectar</button></div>`;
  shadow.querySelector("button")!.addEventListener("click", onConectar);
  document.body.appendChild(host);
  return () => host.remove();
}
