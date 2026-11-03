import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { updateExtensionSettingsAction } from "@/features/browser-extension/actions";
import { sessaoExtensaoAtiva } from "@/features/browser-extension/conexao-status";
import { isExtensionPilotUser } from "@/features/browser-extension/pilot";
import { BROWSER_EXTENSION_MANIFEST_VERSION } from "@/features/browser-extension/manifest-version";
import { ExtensionConnectCard } from "./extension-connect-card";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { ExtensionLiteView } from "../_components/lite/extension-lite-view";

export default async function ExtensionSettingsPage() {
  const context = await getRequiredTenantContext();
  if (!await isExtensionPilotUser(context.userId)) notFound();
  const [settings] = await getDatabase().select({ enabled: schema.extensionSettings.enabled, minimumVersion: schema.extensionSettings.minimumVersion }).from(schema.extensionSettings).where(eq(schema.extensionSettings.tenantId, context.tenantId)).limit(1);
  const canConfigure = context.role === "director";
  // Chave do visual Lite: os mesmos dados e a mesma regra de quem configura, no padrão Lite.
  if (await isDirectorLitePageOnServer(context, "/settings/extension")) {
    return <><DashboardHeader breadcrumb="Configurações / Integrações" title="AncoraHub Assistant" /><main className={litePage.stack}><ExtensionLiteView data={{ conectada: await sessaoExtensaoAtiva(context.userId, context.tenantId), enabled: Boolean(settings?.enabled), minimumVersion: settings?.minimumVersion ?? "0.1.0", extensionVersion: BROWSER_EXTENSION_MANIFEST_VERSION, canConfigure }} /></main></>;
  }
  return <>
    <DashboardHeader breadcrumb="Configurações / Integrações" title="AncoraHub Assistant" />
    <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Atendimento contextual no WhatsApp Web</CardTitle>
          <CardDescription>Baixe a extensão diretamente pelo CRM e conecte este navegador em um clique. Ela nunca envia mensagens automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button render={<a href="/downloads/ancorahub-assistant.zip" download>Baixar AncoraHub Assistant v{BROWSER_EXTENSION_MANIFEST_VERSION}</a>}>Baixar extensão</Button>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Baixe e extraia o arquivo.</li>
            <li>Abra <span className="font-medium">chrome://extensions</span> e ative o modo desenvolvedor.</li>
            <li>Clique em “Carregar sem compactação” e escolha a pasta extraída.</li>
            <li>Clique no ícone da extensão e em “Conectar ao CRM” para conectar em um clique.</li>
            <li>Para atualizar, baixe a versão nova pelo CRM e clique em “Atualizar” em <span className="font-medium">chrome://extensions</span>.</li>
          </ol>
          <p className="text-sm text-muted-foreground">Versão do pacote: {BROWSER_EXTENSION_MANIFEST_VERSION} · Versão mínima: {settings?.minimumVersion ?? "0.1.0"}</p>
          <p className="text-sm text-muted-foreground">Se a conexão em um clique não estiver disponível, gere um código temporário nesta tela e use “Conectar com código” no popup.</p>
          {canConfigure ? <form action={updateExtensionSettingsAction} className="flex items-center gap-3"><input type="hidden" name="enabled" value={settings?.enabled ? "false" : "true"} /><Button type="submit">{settings?.enabled ? "Desativar extensão" : "Habilitar extensão"}</Button><span className="text-sm">{settings?.enabled ? "Ativa para a empresa" : "Desativada pela empresa"}</span></form> : <p className="text-sm text-muted-foreground">A disponibilidade da extensão é definida pelo Diretor da empresa.</p>}
          <ExtensionConnectCard />
          <p className="text-xs text-muted-foreground">A extensão funciona apenas no WhatsApp Web, com escopo autorizado pelo servidor e sessão revogável por dispositivo.</p>
        </CardContent>
      </Card>
    </main>
  </>;
}
