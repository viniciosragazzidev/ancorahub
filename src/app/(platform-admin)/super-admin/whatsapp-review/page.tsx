import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getWhatsAppReviewServiceConfiguration } from "@/features/communication-channels/review-message-service";
import { isMetaCloudWhatsAppEnabled } from "@/features/communication-channels/service";
import { ReviewMessageForm } from "./review-message-form";

export default async function WhatsAppReviewPage() {
  const [service, metaEnabled] = await Promise.all([getWhatsAppReviewServiceConfiguration(), isMetaCloudWhatsAppEnabled()]);
  const ready = service.configured && metaEnabled;

  return <main className="min-h-full bg-background"><PlatformAdminHeader breadcrumb="CorreTop / Meta" title="Revisão do WhatsApp" /><div className="mx-auto w-full max-w-3xl space-y-6 p-4 lg:p-6"><Card><CardHeader><CardTitle>Enviar mensagem de teste</CardTitle><CardDescription>Somente o servidor do CorreTop chama o serviço Fastify; o token da Meta não chega ao navegador.</CardDescription></CardHeader><CardContent>{ready ? <ReviewMessageForm /> : <div className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm"><p className="font-medium">Serviço indisponível para teste</p><p className="mt-1 text-muted-foreground">{!metaEnabled ? "Ative a integração oficial da Meta em Parâmetros do Servidor." : `Configure no CRM: ${service.missing.join(", ")}.`}</p></div>}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Roteiro da evidência</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>1. Mostre esta tela e o domínio do CRM.</p><p>2. Envie para o número de teste autorizado.</p><p>3. Mostre o sucesso e confirme a mesma mensagem no WhatsApp Web ou celular.</p></CardContent></Card></div></main>;
}
