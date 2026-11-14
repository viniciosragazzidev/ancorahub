import { notFound, redirect } from "next/navigation";

import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { BrokerDutyHub } from "@/features/broker-workspace/components/broker-duty-hub";
import { LightDutyCalendar } from "@/features/broker-workspace/components/light-duty-calendar";
import { getCachedBrokerWorkspaceData } from "@/features/broker-workspace/chat/chat-rail-data";
import { getBrokerDutyCalendarData } from "@/features/broker-workspace/duty-calendar-queries";
import { buildDutyHubCurrent } from "@/features/broker-workspace/duty-hub";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function BrokerDutyCalendarPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") notFound();

  const [experienceMode, calendarEnabled, navReorg] = await Promise.all([
    getExperienceMode(context),
    getFeatureFlag(FEATURE_FLAGS.BROKER_DUTY_CALENDAR),
    getFeatureFlag(FEATURE_FLAGS.BROKER_NAV_REORG).catch(() => FEATURE_FLAGS.BROKER_NAV_REORG.defaultValue),
  ]);
  if (experienceMode !== "LIGHT") redirect("/dashboard");

  // Chave desligada: a página anterior, só com o calendário (e sem ele, a operação do plantão).
  if (navReorg !== "true") {
    if (calendarEnabled !== "true") redirect("/plantoes/agora");
    const calendar = await getBrokerDutyCalendarData();
    return <LightDutyCalendar calendar={calendar} />;
  }

  // Entrada única (etapa 3): plantão atual, calendário e escala. Cada parte falha sozinha, sem afirmar que não há escala.
  const now = new Date();
  const [workspace, calendarResult] = await Promise.all([
    getCachedBrokerWorkspaceData().then((data) => ({ ok: true as const, data }), (error: unknown) => {
      console.error("[plantoes] falha ao carregar o plantão atual", error instanceof Error ? error.message : error);
      return { ok: false as const, data: null };
    }),
    calendarEnabled === "true"
      ? getBrokerDutyCalendarData(now).then((data) => ({ ok: true as const, data }), (error: unknown) => {
        console.error("[plantoes] falha ao carregar o calendário de plantões", error instanceof Error ? error.message : error);
        return { ok: false as const, data: null };
      })
      : Promise.resolve(null),
  ]);

  const calendarState = calendarResult === null ? "disabled" : calendarResult.ok ? "ready" : "error";
  const current = buildDutyHubCurrent({
    now,
    duty: workspace.data?.duty,
    workspaceFailed: !workspace.ok,
    calendar: calendarResult?.data ?? null,
    calendarFailed: calendarState === "error",
  });

  return <BrokerDutyHub current={current} calendar={calendarResult?.data ?? null} calendarState={calendarState} />;
}
