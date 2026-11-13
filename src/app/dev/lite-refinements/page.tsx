"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { BeneficiariesSection as Beneficiaries } from "@/app/(dashboard)/leads/[id]/beneficiaries-section";
import { LeadSocialLayout } from "@/features/broker-workspace/chat/lead-social-layout";
import { LeadHeaderBar, NextStepCard } from "@/features/broker-workspace/chat/lead-screen-parts";
import { ChatScreen } from "@/components/chat/chat-screen";
import { Button } from "@/components/arc/button/button";
import { InterfaceMotionProvider } from "@/components/motion/interface-motion-provider";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MessageCircle, Phone, ClipboardList } from "lucide-react";
import page from "@/components/lite/page/lite-page.module.css";
import "@/components/arc/venancor-scope.css";


/** Development-only fixture. Real UI components, synthetic data, no production state. */
export default function LiteRefinementPreview() {
  const [saleOpen, setSaleOpen] = useState(false);
  const [notice, setNotice] = useState("Prévia local com dados fictícios");
  if (process.env.NODE_ENV !== "development") notFound();
  return <InterfaceMotionProvider enabled><main className="arc-venancor">
    <p role="status" className="fixed bottom-1 left-3 z-10 rounded bg-white/90 px-2 text-xs text-muted-foreground">{notice}</p>
    <LeadSocialLayout detailOverlayActive={saleOpen}
      header={<LeadHeaderBar name="Cliente de Demonstração com Nome Completo" statusLabel="Documentação pendente" arrival={null} compact />}
      actions={<nav aria-label="Ações do lead" className="flex gap-2"><Button size="sm" variant="ghost" className={page.iconButton} data-tone="primary" aria-label="Abrir WhatsApp do cliente" title="WhatsApp" onClick={() => setNotice("Prévia: nenhum WhatsApp foi aberto.")}><MessageCircle size={18} /></Button><Button size="sm" variant="ghost" className={page.iconButton} aria-label="Ligar para o cliente" title="Ligar" onClick={() => setNotice("Prévia: nenhuma chamada foi iniciada.")}><Phone size={18} /></Button><Button size="sm" variant="ghost" className={page.iconButton} aria-label="Alterar etapa do lead" title="Etapa" onClick={() => setNotice("Prévia: nenhuma etapa foi alterada.")}><ClipboardList size={18} /></Button></nav>}
      next={<NextStepCard step={{ kind: "whatsapp", title: "Responder o cliente", detail: "O cliente respondeu e espera sua resposta.", tone: "urgent" }} />}
      details={<>
        <LeadHeaderBar name="Cliente de Demonstração com Nome Completo" statusLabel="Documentação pendente" arrival={{ text: "Recebido por você em 03/11, há 10 dias", stale: true }} />
        <div data-form-density="compact"><Beneficiaries leadId="00000000-0000-4000-8000-000000000001" contactName="Cliente de Demonstração" initialBeneficiaries={[{ id: "00000000-0000-4000-8000-000000000002", name: "Cliente de Demonstração", birthDate: "1990-01-15", relationship: "titular", isHolder: true }]} /></div>
        <div data-form-density="compact"><DatePicker label="Data de demonstração" placeholder="Selecione uma data" /></div>
        <Button variant="secondary" onClick={() => setSaleOpen(true)}>Continuar registro</Button>
      </>}
      conversation={<ChatScreen identity={{ name: "Cliente Demo", shape: "mochi", hue: null }} backHref="/dashboard" embedded fill composerDisabled
        script={{ blocks: [
          { type: "assistant", id: "demo-1", text: "Já reuni as informações do seu atendimento. O corretor continuará a conversa por aqui." },
          { type: "user", id: "demo-2", text: "Certo, podemos conversar sobre as opções para minha família?" },
          { type: "system", id: "demo-3", text: "Atendimento iniciado. Histórico de demonstração preservado." },
          { type: "system", id: "demo-4", strong: "Sugestão da IA", text: "Confirme os dados da contratação antes de preparar a proposta.", details: "Confirme os dados da contratação e as pessoas que farão parte do plano. Esta é uma sugestão completa de demonstração, disponível sem cortes e sem dados reais de clientes." },
        ] }} />}
    />
    {saleOpen ? <Dialog open onOpenChange={setSaleOpen}><DialogPopup className="arc-venancor"><DialogTitle>Fluxo de destino de demonstração</DialogTitle><DialogDescription>Somente a passagem entre painéis está em teste. A tela de registro de venda está com o Claude.</DialogDescription><Button onClick={() => setSaleOpen(false)}>Fechar demonstração</Button></DialogPopup></Dialog> : null}
  </main></InterfaceMotionProvider>;
}
