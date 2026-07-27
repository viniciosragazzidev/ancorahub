"use client";

import { useState } from "react";

import { ChatCircleText, Copy, X } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Template = {
  id: string;
  name: string;
  category: string;
  content: string;
  variables: string[];
};

type MessageTemplatePickerProps = {
  templates: Template[];
  onSelect?: (content: string) => void;
};

const CATEGORY_LABELS: Record<string, string> = {
  geral: "Geral",
  apresentacao: "Apresentação",
  follow_up: "Follow-up",
  proposta: "Proposta",
  documentacao: "Documentação",
  encerramento: "Encerramento",
};

export function MessageTemplatePicker({ templates, onSelect }: MessageTemplatePickerProps) {
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase()),
  );

  function selectTemplate(template: Template) {
    const values: Record<string, string> = {};
    template.variables.forEach((v) => {
      values[v] = "";
    });
    setVariableValues(values);
    setSelectedTemplate(template);
  }

  function fillTemplate(template: Template) {
    let content = template.content;
    template.variables.forEach((v) => {
      content = content.replace(new RegExp(`\\{${v}\\}`, "g"), variableValues[v] || `{${v}}`);
    });
    return content;
  }

  function handleCopy(content: string) {
    navigator.clipboard.writeText(content);
    toast.success("Mensagem copiada!");
  }

  function handleUse(template: Template) {
    let content = template.content;
    template.variables.forEach((v) => {
      content = content.replace(new RegExp(`\\{${v}\\}`, "g"), variableValues[v] || `{${v}}`);
    });
    onSelect?.(content);
    setSelectedTemplate(null);
  }

  if (selectedTemplate) {
    return (
      <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold">{selectedTemplate.name}</h4>
          <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => setSelectedTemplate(null)}>
            <X className="size-3" />
          </Button>
        </div>

        {selectedTemplate.variables.length > 0 && (
          <div className="space-y-2">
            {selectedTemplate.variables.map((v) => (
              <div key={v} className="space-y-1">
                <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{v}</label>
                <Input
                  className="h-7 text-xs"
                  value={variableValues[v] ?? ""}
                  onChange={(e) => setVariableValues({ ...variableValues, [v]: e.target.value })}
                  placeholder={`Informe: ${v}`}
                />
              </div>
            ))}
          </div>
        )}

        <div className="rounded-md border border-border/40 bg-background p-2.5 text-xs text-foreground whitespace-pre-wrap">
          {fillTemplate(selectedTemplate)}
        </div>

        <div className="flex gap-2">
          <Button className="h-7 flex-1 text-[10px]" size="sm" onClick={() => handleCopy(fillTemplate(selectedTemplate))}>
            <Copy className="size-3" /> Copiar
          </Button>
          {onSelect && (
            <Button className="h-7 flex-1 text-[10px]" size="sm" onClick={() => handleUse(selectedTemplate)}>
              Usar mensagem
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          className="h-8 pl-8 text-xs"
          placeholder="Buscar templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ChatCircleText className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>

      {filtered.length === 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Nenhum template encontrado.
        </p>
      )}

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {filtered.map((template) => (
          <button
            key={template.id}
            className="w-full rounded-md border border-transparent p-2 text-left text-xs hover:border-border/60 hover:bg-muted/50 transition-colors"
            onClick={() => selectTemplate(template)}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{template.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {CATEGORY_LABELS[template.category] ?? template.category}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-muted-foreground">{template.content.slice(0, 80)}...</p>
          </button>
        ))}
      </div>
    </div>
  );
}
