import { and, asc, desc, eq } from "drizzle-orm";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { getMaterialsChannel } from "@/features/waha-cadence/tenant-channel";
import {
  disconnectMaterialsChannelAction,
  pollMaterialsChannelAction,
  refreshMaterialGroupsAction,
  setMaterialGroupActiveAction,
  startMaterialsChannelAction,
} from "@/features/waha-group-capture/channel-actions";
import { getCaptureStats } from "@/features/waha-group-capture/groups-service";
import { safeLoad, type SafeLoad } from "@/features/waha-group-capture/safe-load";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

import { MaterialGroupsCard } from "../whats_alt/_components/material-groups-card";
import { TenantChannelCard } from "../whats_alt/_components/tenant-channel-card";
import { WhatsAppIntegrationHeading } from "./whatsapp-integration-heading";

const MATERIALS_CARD_TEXTS = {
  title: "Número de materiais",
  description:
    "WhatsApp que já está nos grupos das operadoras. O sistema só lê: não envia mensagens por ele e as conversas dele nunca viram lead. Recomendamos um chip dedicado, separado do canal da diretoria.",
  subject: "Número de materiais",
  pairingHint: "No celular que está nos grupos das operadoras, abra o WhatsApp.",
  idleHint: "Nenhum número conectado. Conecte o celular que já está nos grupos das operadoras para escolher quais grupos ler.",
};

/** What each capture status means for the person who selected the groups. */
const CAPTURE_STATUS_LABELS: Record<string, string> = {
  captured: "Material publicado",
  duplicate_material: "Arquivo repetido (já publicado)",
  stored: "Mensagem registrada, sem arquivo",
  needs_ocr: "PDF escaneado, sem texto",
  needs_vision: "Imagem sem leitor de imagem configurado",
  no_text: "Imagem sem texto útil",
  too_large: "Arquivo grande demais",
  too_small: "Imagem pequena demais",
  expired: "Tabela com vigência vencida",
  error: "Erro ao processar",
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(value);
}

export async function MaterialsWhatsAppView({ context }: { context: TenantContext }) {
  // The tables of this screen come from migrations applied by hand: a missing one must not take the page down.
  const [channel, captureFlag, statsLoad] = await Promise.all([
    getMaterialsChannel(context),
    getFeatureFlag(FEATURE_FLAGS.WAHA_GROUP_CAPTURE),
    safeLoad("materials-stats", () => getCaptureStats(context.tenantId, 7)),
  ]);

  const groupsLoad = channel
    ? await safeLoad("materials-groups", () => getDatabase()
        .select({
          id: schema.wahaGroupSources.id,
          groupId: schema.wahaGroupSources.groupId,
          groupName: schema.wahaGroupSources.groupName,
          active: schema.wahaGroupSources.active,
        })
        .from(schema.wahaGroupSources)
        .where(and(eq(schema.wahaGroupSources.tenantId, context.tenantId), eq(schema.wahaGroupSources.wahaNumberId, channel.id)))
        .orderBy(desc(schema.wahaGroupSources.active), asc(schema.wahaGroupSources.groupName)))
    : ({ ok: true, value: [] } satisfies SafeLoad<never[]>);

  const groups = groupsLoad.ok ? groupsLoad.value : [];
  const stats = statsLoad.ok ? statsLoad.value : null;
  const missingTables = (!statsLoad.ok && statsLoad.missingTables) || (!groupsLoad.ok && groupsLoad.missingTables);
  const loadFailed = !statsLoad.ok || !groupsLoad.ok;

  const captureOn = captureFlag === "true";
  const statusRows = Object.entries(stats?.byStatus ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <main className="flex min-h-full flex-col gap-5 bg-background p-(--mobile-page-padding) antialiased sm:gap-6 lg:p-6">
      <WhatsAppIntegrationHeading active="materiais" canViewDirector />
      <div className="mx-auto grid w-full max-w-7xl gap-5 sm:gap-6">
        <Card variant="overview" className="shadow-sm">
          <CardContent className="px-5 py-4">
            <p className="text-sm leading-5 text-foreground">
              {captureOn
                ? "A captura está ligada pela plataforma. Só os grupos ativos abaixo são lidos."
                : "A captura está desligada pela plataforma. Você já pode conectar o número e escolher os grupos, mas nada é lido até ela ser ligada. Peça ao administrador da plataforma."}
            </p>
          </CardContent>
        </Card>

        <TenantChannelCard
          initialChannel={channel}
          texts={MATERIALS_CARD_TEXTS}
          actions={{
            start: startMaterialsChannelAction,
            poll: pollMaterialsChannelAction,
            disconnect: disconnectMaterialsChannelAction,
          }}
        />

        {loadFailed ? (
          <Card variant="overview" className="shadow-sm">
            <CardContent className="px-5 py-4">
              <p className="text-sm leading-5 text-foreground">
                {missingTables
                  ? "O banco ainda não tem as tabelas desta função (migrações 0203 e 0204). Peça ao administrador da plataforma para aplicar as migrações e recarregue a página. Você já pode conectar o número acima."
                  : "Não foi possível carregar os grupos e o resumo agora. Tente recarregar a página."}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {groupsLoad.ok ? (
          <MaterialGroupsCard
            groups={groups}
            channelReady={channel?.status === "ready"}
            actions={{ refresh: refreshMaterialGroupsAction, toggle: setMaterialGroupActiveAction }}
          />
        ) : null}

        {stats ? (
        <Card variant="overview" className="shadow-sm">
          <CardHeader className="gap-1 border-b border-border/70 px-5 py-4">
            <CardTitle>Últimos 7 dias</CardTitle>
            <CardDescription>
              O que a captura fez com as mensagens dos grupos ativos.
              {stats.lastMessageAt ? ` Última mensagem em ${formatDateTime(stats.lastMessageAt)}.` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 py-4">
            {stats.total === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma mensagem de grupo capturada ainda.</p>
            ) : (
              <dl className="grid gap-2 sm:grid-cols-2">
                {statusRows.map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2">
                    <dt className="text-sm text-foreground">{CAPTURE_STATUS_LABELS[status] ?? status}</dt>
                    <dd className="text-sm font-medium tabular-nums text-foreground">{count}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
        ) : null}
      </div>
    </main>
  );
}
