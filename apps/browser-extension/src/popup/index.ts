type ApiResult = { ok: boolean; status: number; body: Record<string, unknown> };

const root = document.querySelector("#root")!;

function render(content: string) {
  root.innerHTML = `<style>
    :root{color:#e9edef;background:#111b21;font:14px Inter,system-ui,sans-serif}body{margin:0;min-width:300px;background:#111b21}main{padding:18px}.mark{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:9px;background:#123d35;color:#1fbf91;font-weight:800}.heading{display:flex;align-items:center;gap:10px}.heading h1{margin:0;font-size:16px}.muted{margin:8px 0 0;color:#aebac1;font-size:12px;line-height:1.45}input,button{width:100%;box-sizing:border-box;margin-top:12px;padding:10px;border-radius:8px;font:inherit}input{border:1px solid #3b4a54;background:#202c33;color:#e9edef}button{border:0;background:#176b5d;color:#fff;font-weight:700;cursor:pointer}button.secondary{border:1px solid #3b4a54;background:transparent;color:#e9edef}.status{margin-top:14px;padding:10px;border:1px solid #28584d;border-radius:8px;background:#122f29;color:#b9f6e4;font-size:12px;line-height:1.45}</style><main>${content}</main>`;
}

const REQUEST_TIMEOUT_MS = 15000;

function request(path: string, method = "GET", body?: unknown) {
  return new Promise<ApiResult>((resolve) => {
    let settled = false;
    let timer: number | undefined;
    const finish = (result: ApiResult) => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(result);
      }
    };
    try {
      chrome.runtime.sendMessage({ type: "API_REQUEST", payload: { path, method, body } }, (response) => {
        if (chrome.runtime.lastError || !response || typeof response !== "object" || !("ok" in response)) {
          finish({ ok: false, status: 0, body: {} });
          return;
        }
        finish(response);
      });
      timer = window.setTimeout(() => finish({ ok: false, status: 0, body: {} }), REQUEST_TIMEOUT_MS);
    } catch {
      finish({ ok: false, status: 0, body: {} });
    }
  });
}

async function showConnected() {
  render(`<div class="heading"><span class="mark">A</span><h1>AncoraHub Assistant</h1></div><p class="status">Conectada neste navegador.</p><p class="muted">O painel só aparece em conversas de leads atribuídos a você e à sua unidade.</p><button class="secondary" id="disconnect">Desconectar extensão</button>`);
  document.querySelector("#disconnect")!.addEventListener("click", async () => {
    const button = document.querySelector<HTMLButtonElement>("#disconnect")!;
    button.disabled = true;
    button.textContent = "Desconectando…";
    const result = await request("/api/extension/auth/revoke", "POST");
    if (!result.ok) {
      button.disabled = false;
      button.textContent = "Não foi possível desconectar. Tente novamente.";
      return;
    }
    await chrome.storage.session.remove("token").catch(() => undefined);
    void showDisconnected();
  });
}

function showDisconnected(message?: string) {
  render(`<div class="heading"><span class="mark">A</span><h1>AncoraHub Assistant</h1></div><p class="muted">Conecte usando o código temporário gerado no CRM.</p><input id="code" placeholder="Código temporário" autocomplete="one-time-code"><button id="connect">Conectar</button><p class="muted" id="status">${message ?? ""}</p>`);
  document.querySelector("#connect")!.addEventListener("click", async () => {
    const status = document.querySelector("#status")!;
    const code = (document.querySelector("#code") as HTMLInputElement).value.trim();
    if (!code) { status.textContent = "Informe o código gerado no CRM."; return; }
    status.textContent = "Conectando…";
    try {
      const response = await fetch("https://corretop.vercel.app/api/extension/auth/exchange", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, deviceId: crypto.randomUUID(), extensionVersion: "0.1.2" }) });
      const body = await response.json();
      if (!response.ok || typeof body.token !== "string") throw new Error("INVALID_CODE");
      await chrome.storage.session.set({ token: body.token });
      await showConnected();
    } catch {
      status.textContent = "Não foi possível conectar. Gere um novo código no CRM.";
    }
  });
}

void (async () => {
  const { token } = await chrome.storage.session.get("token");
  if (!token) return showDisconnected();
  const session = await request("/api/extension/session");
  if (session.ok || session.status !== 401) return showConnected();
  await chrome.storage.session.remove("token").catch(() => undefined);
  showDisconnected("A sessão expirou. Gere um novo código no CRM.");
})().catch(() => showDisconnected());
