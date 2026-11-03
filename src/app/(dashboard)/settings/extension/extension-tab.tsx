import { eq } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateExtensionSettingsAction } from "@/features/browser-extension/actions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { isExtensionPilotUser } from "@/features/browser-extension/pilot";
import { BROWSER_EXTENSION_MANIFEST_VERSION } from "@/features/browser-extension/manifest-version";
import { ExtensionConnectCard } from "./extension-connect-card";
import { ExtensionHelpDialog } from "./extension-help-dialog";

export async function ExtensionTab() {
  const context = await getRequiredTenantContext();
  if (!await isExtensionPilotUser(context.userId)) return null;
  const [settings] = await getDatabase()
    .select({ enabled: schema.extensionSettings.enabled, minimumVersion: schema.extensionSettings.minimumVersion })
    .from(schema.extensionSettings)
    .where(eq(schema.extensionSettings.tenantId, context.tenantId))
    .limit(1);
  const canConfigure = context.role === "director";

  return (
    <Card className="max-w-2xl border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle>Atendimento contextual no WhatsApp Web</CardTitle>
        <CardDescription>
          Conecte o seu navegador ao CRM para abrir rapidamente o lead certo durante o atendimento. A extensão nunca envia mensagens automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button render={<a href="/downloads/ancorahub-assistant.zip" download>Baixar AncoraHub Assistant v{BROWSER_EXTENSION_MANIFEST_VERSION}</a>}>
            Baixar extensão
          </Button>
          <ExtensionHelpDialog version={BROWSER_EXTENSION_MANIFEST_VERSION} />
        </div>
        <p className="text-sm text-muted-foreground">
          Versão do pacote: {BROWSER_EXTENSION_MANIFEST_VERSION} · Versão mínima: {settings?.minimumVersion ?? "0.1.0"}. Para atualizar, baixe a nova versão pelo CRM e clique em “Atualizar” em <span className="font-medium text-foreground">chrome://extensions</span>.
        </p>
        <p className="text-sm text-muted-foreground">Baixe e extraia o pacote, ative o modo desenvolvedor em chrome://extensions, clique em “Carregar sem compactação” e selecione a pasta. Depois clique no ícone da extensão e em “Conectar ao CRM”. Se necessário, o código temporário nesta tela fica como alternativa.</p>
        {canConfigure ? (
          <form action={updateExtensionSettingsAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="enabled" value={settings?.enabled ? "false" : "true"} />
            <Button type="submit">{settings?.enabled ? "Desativar extensão para a empresa" : "Habilitar extensão para a empresa"}</Button>
            <span className="text-sm text-muted-foreground">{settings?.enabled ? "Ativa para a empresa" : "Desativada pela empresa"}</span>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">A disponibilidade é definida pelo Diretor. Quando habilitada, você pode instalar e conectar o seu navegador nesta tela.</p>
        )}
        <ExtensionConnectCard />
        <p className="text-xs text-muted-foreground">O painel só é exibido no WhatsApp Web para leads atribuídos ao seu usuário e à sua unidade. A sessão é revogável por dispositivo.</p>
      </CardContent>
    </Card>
  );
}
