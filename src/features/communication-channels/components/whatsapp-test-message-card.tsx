"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { sendWhatsAppTestMessageAction } from "@/features/ai-qualification/actions";
import type { SendWhatsAppTestMessageResult } from "@/features/ai-qualification/whatsapp-diagnostic-service";

export function WhatsAppTestMessageCard({ className }: { className?: string }) {
  const [testDestPhone, setTestDestPhone] = useState("");
  const [testMsgType, setTestMsgType] = useState<"free_text" | "approved_template" | "internal_test">("free_text");
  const [testMsgText, setTestMsgText] = useState("Teste de conexão do WhatsApp AncoraHub.");
  const [testResult, setTestResult] = useState<SendWhatsAppTestMessageResult | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testDestPhone.trim()) {
      toast.error("Informe um número de telefone de teste.");
      return;
    }
    setIsSendingTest(true);
    try {
      const result = await sendWhatsAppTestMessageAction({
        destinationNumber: testDestPhone,
        messageType: testMsgType,
        messageText: testMsgText,
      });
      setTestResult(result);
      if (result.acceptedByMeta) {
        toast.success("Mensagem encaminhada para a Meta.", {
          description: "A entrega ao destinatário será confirmada pelo status da conversa.",
        });
      } else {
        toast.error("A Meta não enviou a mensagem de teste.", {
          description: result.errorReason ?? "Revise o número e tente novamente.",
        });
      }
    } catch (err) {
      toast.error("Não foi possível iniciar o teste de WhatsApp.", {
        description: "Confira se o número oficial está ativo na Cloud API e tente novamente.",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <Card variant="subtle" className={cn("rounded-xl border-border/80 p-5 space-y-4", className)}>
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Send className="size-4 text-primary" />
          Envio de Mensagem de Teste (Rastreável)
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Envie mensagens diretas com rastreamento de entregabilidade e custos estimados.
        </p>
      </div>

      <form onSubmit={handleSendTestMessage} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Número de destino</Label>
            <Input
              value={testDestPhone}
              onChange={(e) => setTestDestPhone(e.target.value)}
              placeholder="+55 71 99999-9999"
            />
            <p className="text-xs text-muted-foreground">
              Para números brasileiros, o código +55 é aplicado automaticamente.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Tipo de Mensagem</Label>
            <Select
              value={testMsgType}
              onValueChange={(val) => setTestMsgType(val as "free_text" | "approved_template" | "internal_test")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free_text">Texto livre (Janela de 24h)</SelectItem>
                <SelectItem value="approved_template">Template oficial aprovado</SelectItem>
                <SelectItem value="internal_test">Teste interno de diagnóstico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">Conteúdo da Mensagem</Label>
          <Textarea
            value={testMsgText}
            onChange={(e) => setTestMsgText(e.target.value)}
            rows={2}
          />
        </div>

        <Button type="submit" disabled={isSendingTest} size="sm" className="gap-2">
          <Send className="size-3.5" />
          {isSendingTest ? "Enviando para Meta..." : "Enviar Teste de Conexão"}
        </Button>
      </form>

      {testResult && (
        <div
          className={cn(
            "rounded-lg border p-4 text-xs space-y-2",
            testResult.acceptedByMeta
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-destructive/30 bg-destructive/5"
          )}
          role="status"
        >
          <div
            className={cn(
              "flex items-center gap-2 font-semibold",
              testResult.acceptedByMeta ? "text-emerald-600" : "text-destructive"
            )}
          >
            {testResult.acceptedByMeta ? <Check className="size-4" /> : <AlertTriangle className="size-4" />}
            {testResult.acceptedByMeta ? "Mensagem aceita pela Meta" : "Mensagem não enviada"}
          </div>
          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
            <div>{testResult.acceptedByMeta ? "ID Meta:" : "Referência do teste:"} <span className="font-mono text-foreground">{testResult.messageId}</span></div>
            <div>Status Inicial: <Badge variant="outline">{testResult.initialStatus}</Badge></div>
            <div>Custo Estimado: <span className="font-semibold text-foreground">R$ {testResult.estimatedCostBrl.toFixed(2)}</span></div>
            <div>Destino Mascarado: <span className="font-mono text-foreground">{testResult.maskedDestination}</span></div>
          </div>
          {!testResult.acceptedByMeta && testResult.errorReason ? (
            <p className="rounded-md bg-background/70 p-3 leading-relaxed text-foreground" role="alert">
              {testResult.errorReason}
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
