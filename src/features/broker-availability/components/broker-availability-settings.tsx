import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrokerAvailabilityScheduleEditor } from "./broker-availability-schedule-editor";
import type { BrokerAvailabilityWindowInput } from "../contracts";

export function BrokerAvailabilitySettings({ windows, schemaReady = true }: { windows: BrokerAvailabilityWindowInput[]; schemaReady?: boolean }) {
  return <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>Disponibilidade para novos leads</CardTitle><CardDescription>Defina os dias e horários em que a distribuição automática pode incluir você. Fora deles, você continua vendo sua carteira atual, mas não recebe novos leads automaticamente.</CardDescription></CardHeader><CardContent>{schemaReady ? <BrokerAvailabilityScheduleEditor initialWindows={windows} /> : <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-muted-foreground">A configuração de disponibilidade está sendo preparada. Suas demais áreas do CRM continuam disponíveis; tente novamente em alguns minutos.</p>}</CardContent></Card>;
}
