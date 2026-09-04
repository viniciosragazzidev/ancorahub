"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { saveAiAgentConfigAction } from "../actions";

interface AiAgentWizardClientProps {
  initialConfig: {
    enabled: boolean;
    assistantName: string;
    initialMessage: string;
    finalMessage: string;
    handoffMessage: string;
    outOfHoursMessage: string;
    absenceMessage: string;
    language: "pt-BR" | "en" | "es";
    tone: "friendly" | "professional" | "direct";
    useEmojis: boolean;
    formOfAddress: "voce" | "primeiro_nome" | "senhor_senhora";
    maxQuestions: number;
    businessContext: string;
    customInstructions: string;
    requiredFields: string[];
  };
}

export function AiAgentWizardClient({ initialConfig }: AiAgentWizardClientProps) {
  const [step, setStep] = React.useState(1);
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(initialConfig.enabled);
  const [assistantName, setAssistantName] = React.useState(initialConfig.assistantName);
  const [initialMessage, setInitialMessage] = React.useState(initialConfig.initialMessage);
  const [finalMessage, setFinalMessage] = React.useState(initialConfig.finalMessage);
  const [handoffMessage, setHandoffMessage] = React.useState(initialConfig.handoffMessage);
  const [outOfHoursMessage, setOutOfHoursMessage] = React.useState(initialConfig.outOfHoursMessage);
  const [absenceMessage, setAbsenceMessage] = React.useState(initialConfig.absenceMessage);
  const [language, setLanguage] = React.useState<"pt-BR" | "en" | "es">(initialConfig.language);
  const [tone, setTone] = React.useState<"friendly" | "professional" | "direct">(initialConfig.tone);
  const [useEmojis, setUseEmojis] = React.useState(initialConfig.useEmojis);
  const [formOfAddress, setFormOfAddress] = React.useState<"voce" | "primeiro_nome" | "senhor_senhora">(initialConfig.formOfAddress);
  const [maxQuestions, setMaxQuestions] = React.useState(initialConfig.maxQuestions);
  const [businessContext, setBusinessContext] = React.useState(initialConfig.businessContext);
  const [customInstructions, setCustomInstructions] = React.useState(initialConfig.customInstructions);
  const [requiredFields, setRequiredFields] = React.useState<string[]>(initialConfig.requiredFields || []);

  const handleSave = async () => {
    const res = await saveAiAgentConfigAction({
      enabled,
      assistantName,
      initialMessage,
      finalMessage,
      handoffMessage,
      outOfHoursMessage,
      absenceMessage,
      language,
      tone,
      useEmojis,
      formOfAddress,
      maxQuestions,
      businessContext,
      customInstructions,
      requiredFields,
    });

    if (res.success) {
      toast.success("Configuracoes do assistente de IA salvas com sucesso.");
      router.refresh();
    } else {
      toast.error(res.error || "Erro ao salvar configuracoes.");
    }
  };

  const toggleField = (field: string) => {
    if (requiredFields.includes(field)) {
      setRequiredFields(requiredFields.filter((f) => f !== field));
    } else {
      setRequiredFields([...requiredFields, field]);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Configuracao do Agente de IA</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure as diretrizes, tom de voz, conhecimento e comportamento de qualificacao do assistente de IA.
        </p>
      </div>

      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Passo {step} de 4</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Status do Agente</span>
              <Checkbox
                checked={enabled}
                onCheckedChange={(checked) => setEnabled(!!checked)}
              />
              <span className="text-xs font-medium">{enabled ? "Ativo" : "Inativo"}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Informacoes do Assistente</h3>
              <p className="text-xs text-slate-500">Defina o nome de exibicao e a persona conversacional.</p>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Nome do Agente / Assistente</label>
                <Input
                  value={assistantName}
                  onChange={(e) => setAssistantName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Idioma Principal</label>
                  <Select value={language} onValueChange={(val) => setLanguage((val || "pt-BR") as "pt-BR" | "en" | "es")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-BR">Portugues (pt-BR)</SelectItem>
                      <SelectItem value="en">Ingles (en)</SelectItem>
                      <SelectItem value="es">Espanhol (es)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Tom de Voz</label>
                  <Select value={tone} onValueChange={(val) => setTone((val || "friendly") as "friendly" | "professional" | "direct")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tom" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">Amigavel</SelectItem>
                      <SelectItem value="professional">Profissional</SelectItem>
                      <SelectItem value="direct">Direto / Objetivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Tratamento / Formalidade</label>
                  <Select value={formOfAddress} onValueChange={(val) => setFormOfAddress((val || "voce") as "voce" | "primeiro_nome" | "senhor_senhora")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a formalidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="voce">Você (Informal)</SelectItem>
                      <SelectItem value="primeiro_nome">Primeiro Nome</SelectItem>
                      <SelectItem value="senhor_senhora">Senhor / Senhora (Formal)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <Checkbox
                    id="useEmojis"
                    checked={useEmojis}
                    onCheckedChange={(checked) => setUseEmojis(!!checked)}
                  />
                  <label htmlFor="useEmojis" className="text-xs font-semibold cursor-pointer">
                    Usar emojis moderadamente
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Escopo e Perguntas Permitidas</h3>
              <p className="text-xs text-slate-500">Selecione quais dados o agente deve colher antes do handoff.</p>

              <div className="grid grid-cols-2 gap-4 border border-slate-100 dark:border-slate-800 p-4 rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                {["nome", "tipo_plano", "vidas", "idades", "cidade", "email"].map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Checkbox
                      id={`field-${f}`}
                      checked={requiredFields.includes(f)}
                      onCheckedChange={() => toggleField(f)}
                    />
                    <label htmlFor={`field-${f}`} className="text-xs font-semibold capitalize cursor-pointer">
                      {f.replace("_", " ")}
                    </label>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Limite Maximo de Perguntas</label>
                <Input
                  type="number"
                  value={maxQuestions}
                  onChange={(e) => setMaxQuestions(Number(e.target.value))}
                  min={1}
                  max={15}
                />
                <p className="text-[10px] text-slate-400">Apos este limite, a conversa sera transferida para um corretor humano.</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Conhecimento e Instrucoes</h3>
              <p className="text-xs text-slate-500">Ensine as regras do seu negocio e como responder ao cliente.</p>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Contexto da Corretora / Conhecimento Autorizado</label>
                <Textarea
                  placeholder="Informacoes sobre operadoras parceiras, especialidades, etc."
                  value={businessContext}
                  onChange={(e) => setBusinessContext(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Instrucoes Adicionais do Diretor</label>
                <Textarea
                  placeholder="Instrucoes especificas de comportamento, regras de negocio..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Politicas de Resiliencia e Mensagens</h3>
              <p className="text-xs text-slate-500">Defina as politicas de resposta automatica e textos padrao.</p>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Mensagem de Boas-Vindas Inicial</label>
                <Input
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Mensagem de Conclusao / Agradecimento</label>
                <Input
                  value={finalMessage}
                  onChange={(e) => setFinalMessage(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Mensagem de Handoff Humano</label>
                <Input
                  value={handoffMessage}
                  onChange={(e) => setHandoffMessage(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Mensagem Fora de Horario Comercial</label>
                <Input
                  value={outOfHoursMessage}
                  onChange={(e) => setOutOfHoursMessage(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Mensagem de Ausencia (Corretores Ocupados)</label>
                <Input
                  value={absenceMessage}
                  onChange={(e) => setAbsenceMessage(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
          >
            Anterior
          </Button>

          {step < 4 ? (
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => setStep(step + 1)}
            >
              Proximo
            </Button>
          ) : (
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleSave}
            >
              Salvar Configuracoes
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
