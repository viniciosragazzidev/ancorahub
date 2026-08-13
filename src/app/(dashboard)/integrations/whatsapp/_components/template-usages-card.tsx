"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, InfoIcon } from "@/components/huge-icons";

type EventMapping = {
  eventKey: string;
  label: string;
  mapping: {
    id: string;
    templateId: string;
    templateName: string;
    templateLanguage: string;
    templateStatus: string;
    active: boolean;
  } | null;
};

type ApprovedTemplate = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
};

export function TemplateUsagesCard({ canManage }: { canManage: boolean }) {
  const [events, setEvents] = useState<EventMapping[]>([]);
  const [approvedTemplates, setApprovedTemplates] = useState<ApprovedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usagesRes, templatesRes] = await Promise.all([
        fetch("/api/integrations/whatsapp/templates/usages"),
        fetch("/api/integrations/whatsapp/templates?status=APPROVED"),
      ]);

      const usagesData = await usagesRes.json();
      const templatesData = await templatesRes.json();

      if (usagesRes.ok) {
        setEvents(usagesData.events || []);
        const initialSelections: Record<string, string> = {};
        (usagesData.events || []).forEach((ev: EventMapping) => {
          if (ev.mapping?.templateId) {
            initialSelections[ev.eventKey] = ev.mapping.templateId;
          }
        });
        setSelectedMap(initialSelections);
      }

      if (templatesRes.ok) {
        setApprovedTemplates(templatesData.templates || []);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const handleSave = async (eventKey: string) => {
    const templateId = selectedMap[eventKey];
    if (!templateId) return;

    setSavingKey(eventKey);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/whatsapp/templates/usages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventKey,
          templateId,
          active: true,
        }),
      });

      if (res.ok) {
        setMessage("Vínculo salvo com sucesso!");
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao salvar vínculo.");
      }
    } catch {
      alert("Erro de conexão ao salvar vínculo.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle>Mapeamento de eventos comerciais</CardTitle>
        <CardDescription className="mt-1">
          Associe cada ação automática do CRM a um template da Meta aprovado em status APPROVED.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando vínculos...</div>
        ) : (
          <div className="divide-y divide-border/60">
            {events.map((ev) => {
              const currentTemplateId = selectedMap[ev.eventKey] || "";

              return (
                <div key={ev.eventKey} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{ev.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">Evento: {ev.eventKey}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={currentTemplateId}
                      onValueChange={(val) => val && setSelectedMap((prev) => ({ ...prev, [ev.eventKey]: val }))}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="w-64 text-xs">
                        <SelectValue placeholder="Selecione um template aprovado..." />
                      </SelectTrigger>
                      <SelectContent>
                        {approvedTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-xs font-mono">
                            {t.name} ({t.language})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {canManage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSave(ev.eventKey)}
                        disabled={savingKey === ev.eventKey || !currentTemplateId}
                      >
                        <Check className="size-3.5 mr-1" />
                        Salvar
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {message ? <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{message}</p> : null}

        <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground flex items-center gap-2">
          <InfoIcon className="size-4 shrink-0 text-primary" />
          <span>
            Caso nenhum template seja selecionado, o CRM utilizará o template padrão homologado como fallback automático.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
