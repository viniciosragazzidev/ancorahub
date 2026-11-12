import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { readAutoSaleFlags } from "../flag";
import { updateAutoSaleAutopilotAction, updateAutoSaleParamsAction, updateAutoSaleTenantAction } from "../super-admin-actions";

const FIELDS = [
  { key: "burstWaitSeconds", label: "Espera da rajada (s)" },
  { key: "messagesPerHour", label: "Mensagens por hora" },
  { key: "messagesPerDay", label: "Mensagens por dia" },
  { key: "sendStartHour", label: "Início do envio (h)" },
  { key: "sendEndHour", label: "Fim do envio (h)" },
  { key: "audioPerDealPerDay", label: "Áudios por dia" },
  { key: "audioMaxSeconds", label: "Duração máxima do áudio (s)" },
  { key: "idleManagerHours", label: "Prazo do gestor (h)" },
] as const;

/** Bloco do Super-admin › Empresa: Venda Automatizada (piloto), Autopiloto e parâmetros. */
export async function AutoSaleSuperAdminCard({ tenantId }: { tenantId: string }) {
  const flags = await readAutoSaleFlags(tenantId);
  const toggle = updateAutoSaleTenantAction.bind(null, tenantId);
  const autopilot = updateAutoSaleAutopilotAction.bind(null, tenantId);
  const params = updateAutoSaleParamsAction.bind(null, tenantId);
  return (
    <div className="grid gap-4 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">Venda Automatizada (piloto)</h3>
            <Badge variant={flags.enabled ? "success" : "outline"}>{flags.enabled ? "Ligada" : "Desligada"}</Badge>
            {!flags.global ? <Badge variant="warning">Pausada para todas as empresas</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">O diretor escolhe um lead quente por vez e a assistente virtual conduz a venda em Simulação ou Copiloto, com a transcrição de áudio na negociação. Nunca passa o lead a um corretor sozinha. Só liga com o catálogo de planos desta empresa.</p>
        </div>
        <form action={toggle}>
          <input name="enabled" type="hidden" value={flags.enabled ? "false" : "true"} />
          <Button type="submit" variant={flags.enabled ? "outline" : "default"}>{flags.enabled ? "Desligar" : "Ligar"}</Button>
        </form>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">Autopiloto</h3>
            <Badge variant={flags.autopilot ? "success" : "outline"}>{flags.autopilot ? "Liberado" : "Bloqueado"}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Libera o diretor a pôr uma negociação em Autopiloto (envia sozinha, só planos revisados, com limites). Ligar só depois de 5 negociações em Copiloto.</p>
        </div>
        <form action={autopilot}>
          <input name="enabled" type="hidden" value={flags.autopilot ? "false" : "true"} />
          <Button type="submit" variant="outline">{flags.autopilot ? "Bloquear" : "Liberar"}</Button>
        </form>
      </div>
      <form action={params} className="grid gap-3">
        <p className="text-sm font-medium">Parâmetros</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FIELDS.map((field) => (
            <div key={field.key} className="grid gap-1.5">
              <Label htmlFor={`auto-sale-${field.key}`} className="text-xs">{field.label}</Label>
              <Input id={`auto-sale-${field.key}`} name={field.key} type="number" inputMode="numeric" defaultValue={flags.settings[field.key]} />
            </div>
          ))}
        </div>
        <div><Button type="submit" variant="outline" size="sm">Salvar parâmetros</Button></div>
      </form>
    </div>
  );
}
