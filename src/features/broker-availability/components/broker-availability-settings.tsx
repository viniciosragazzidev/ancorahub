import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrokerAvailabilityScheduleEditor } from "./broker-availability-schedule-editor";
import type { BrokerAvailabilityWindowInput } from "../service";

export function BrokerAvailabilitySettings({ windows }: { windows: BrokerAvailabilityWindowInput[] }) {
  return <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>Disponibilidade para novos leads</CardTitle><CardDescription>Defina os dias e horários em que a distribuição automática pode incluir você. Fora deles, você continua vendo sua carteira atual, mas não recebe novos leads automaticamente.</CardDescription></CardHeader><CardContent><BrokerAvailabilityScheduleEditor initialWindows={windows} /></CardContent></Card>;
}
