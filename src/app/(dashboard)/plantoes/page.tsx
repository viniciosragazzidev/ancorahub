import { notFound, redirect } from "next/navigation";

import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { LightDutyCalendar } from "@/features/broker-workspace/components/light-duty-calendar";
import { getBrokerDutyCalendarData } from "@/features/broker-workspace/duty-calendar-queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function BrokerDutyCalendarPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") notFound();

  const [experienceMode, calendarEnabled] = await Promise.all([
    getExperienceMode(context),
    getFeatureFlag(FEATURE_FLAGS.BROKER_DUTY_CALENDAR),
  ]);
  if (experienceMode !== "LIGHT") redirect("/dashboard");
  // Without the calendar, "Ver plantões" links land on the Plantão conversation (always there),
  // never on a "Registro não encontrado" page.
  if (calendarEnabled !== "true") redirect("/dashboard/c/plantao");

  const calendar = await getBrokerDutyCalendarData();
  return <LightDutyCalendar calendar={calendar} />;
}
