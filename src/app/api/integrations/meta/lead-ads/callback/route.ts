import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForLongLivedToken } from "@/features/meta-ads/meta-oauth";
import { MetaGraphClient } from "@/features/meta-ads/meta-graph-client";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorReason = searchParams.get("error_reason");
  const errorDescription = searchParams.get("error_description");

  if (error || !code) {
    const errorMsg = errorDescription || errorReason || error || "Código de autorização não recebido da Meta.";
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
      <head><title>Erro na Autenticação Meta</title></head>
      <body style="font-family: system-ui, sans-serif; display: grid; place-content: center; height: 100vh; background: #0f172a; color: #f8fafc;">
        <div style="text-align: center; max-width: 400px; padding: 2rem; background: #1e293b; border-radius: 1rem; border: 1px solid #334155;">
          <h2 style="color: #ef4444; margin-bottom: 0.5rem;">Falha na Conexão Meta</h2>
          <p style="font-size: 0.875rem; color: #94a3b8;">${errorMsg}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'META_AUTH_ERROR', error: '${errorMsg}' }, '*');
              setTimeout(() => window.close(), 3000);
            }
          </script>
        </div>
      </body>
      </html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/integrations/meta/lead-ads/callback`;
    const tokenData = await exchangeCodeForLongLivedToken(code, redirectUri);
    const client = new MetaGraphClient(tokenData.accessToken);
    const assets = await client.discoverAssets();

    return new NextResponse(
      `<!DOCTYPE html>
      <html>
      <head><title>Autenticação Meta Concluída</title></head>
      <body style="font-family: system-ui, sans-serif; display: grid; place-content: center; height: 100vh; background: #0f172a; color: #f8fafc;">
        <div style="text-align: center; max-width: 400px; padding: 2rem; background: #1e293b; border-radius: 1rem; border: 1px solid #334155;">
          <h2 style="color: #22c55e; margin-bottom: 0.5rem;">Meta Conectada!</h2>
          <p style="font-size: 0.875rem; color: #94a3b8;">Importando ativos descobertos para o CorreTop...</p>
          <script>
            const assets = ${JSON.stringify(assets)};
            if (window.opener) {
              window.opener.postMessage({ type: 'META_AUTH_SUCCESS', code: '${code}', assets: assets }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              window.location.href = '/integrations/meta';
            }
          </script>
        </div>
      </body>
      </html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (err: any) {
    const msg = err?.message || "Falha ao processar autorização Meta.";
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
      <head><title>Erro na Autenticação Meta</title></head>
      <body style="font-family: system-ui, sans-serif; display: grid; place-content: center; height: 100vh; background: #0f172a; color: #f8fafc;">
        <div style="text-align: center; max-width: 400px; padding: 2rem; background: #1e293b; border-radius: 1rem; border: 1px solid #334155;">
          <h2 style="color: #ef4444; margin-bottom: 0.5rem;">Erro de Ativos</h2>
          <p style="font-size: 0.875rem; color: #94a3b8;">${msg}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'META_AUTH_ERROR', error: '${msg}' }, '*');
              setTimeout(() => window.close(), 3000);
            }
          </script>
        </div>
      </body>
      </html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}
