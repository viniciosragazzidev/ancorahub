const root = document.querySelector("#root")!;
root.innerHTML = `<style>body{font:14px system-ui;min-width:280px;padding:16px;color:#17212b}input,button{width:100%;box-sizing:border-box;padding:9px;margin-top:8px}button{background:#176b5d;color:white;border:0;border-radius:6px}</style><h2>CorreTop Assistant</h2><p>Conecte usando o código gerado no CRM.</p><input id="code" placeholder="Código temporário"><button id="connect">Conectar</button><p id="status"></p>`;
document.querySelector("#connect")!.addEventListener("click", async () => {
  const status = document.querySelector("#status")!; status.textContent = "Conectando…";
  const code = (document.querySelector("#code") as HTMLInputElement).value;
  try { const response = await fetch("https://corretop.vercel.app/api/extension/auth/exchange", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, deviceId: crypto.randomUUID(), extensionVersion: "0.1.0" }) }); const body = await response.json(); if (!response.ok) throw new Error("Código inválido"); await chrome.storage.session.set({ token: body.token }); status.textContent = "Extensão conectada."; } catch { status.textContent = "Não foi possível conectar. Gere um novo código no CRM."; }
});
