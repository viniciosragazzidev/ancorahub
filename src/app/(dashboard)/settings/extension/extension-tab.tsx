import { eq } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateExtensionSettingsAction } from "@/features/browser-extension/actions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { ExtensionConnectCard } from "./extension-connect-card";
import { ExtensionHelpDialog } from "./extension-help-dialog";

export async function ExtensionTab() {
  const context = await getRequiredTenantContext();
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
          <Button render={<a href="/downloads/ancorahub-assistant.zip" download>Baixar AncoraHub Assistant</a>}>
            Baixar extensão
          </Button>
          <ExtensionHelpDialog />
        </div>
        <p className="text-sm text-muted-foreground">
          Após baixar, extraia o arquivo e adicione a pasta em <span className="font-medium text-foreground">chrome://extensions</span>. Quando a publicação na Chrome Web Store estiver disponível, a instalação poderá ser feita em um clique.
        </p>
        <p className="text-sm text-muted-foreground">Versão mínima: {settings?.minimumVersion ?? "0.1.0"}</p>
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
