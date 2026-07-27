import { eq } from "drizzle-orm";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { updateExtensionSettingsAction } from "@/features/browser-extension/actions";
import { ExtensionConnectCard } from "./extension-connect-card";

export default async function ExtensionSettingsPage() {
  const context = await getRequiredTenantContext();
  const [settings] = await getDatabase().select({ enabled: schema.extensionSettings.enabled, minimumVersion: schema.extensionSettings.minimumVersion }).from(schema.extensionSettings).where(eq(schema.extensionSettings.tenantId, context.tenantId)).limit(1);
  const canConfigure = context.role === "director";
  return <><DashboardHeader breadcrumb="Configurações / Integrações" title="CorreTop Assistant" /><main className="flex flex-1 flex-col gap-6 p-4 lg:p-6"><Card className="max-w-2xl"><CardHeader><CardTitle>Atendimento contextual no WhatsApp Web</CardTitle><CardDescription>Conecte a extensão usando um código temporário. Ela só identifica a conversa aberta e nunca envia mensagens automaticamente.</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Versão mínima: {settings?.minimumVersion ?? "0.1.0"}</p>{canConfigure ? <form action={updateExtensionSettingsAction} className="flex items-center gap-3"><input type="hidden" name="enabled" value={settings?.enabled ? "false" : "true"} /><Button type="submit">{settings?.enabled ? "Desativar extensão" : "Habilitar extensão"}</Button><span className="text-sm">{settings?.enabled ? "Ativa para a empresa" : "Desativada pela empresa"}</span></form> : <p className="text-sm text-muted-foreground">A disponibilidade da extensão é definida pelo Diretor da empresa.</p>}<ExtensionConnectCard /><p className="text-xs text-muted-foreground">A extensão funciona apenas no WhatsApp Web, com escopo autorizado pelo servidor e sessão revogável por dispositivo.</p></CardContent></Card></main></>;
}
