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
import social from "@/features/broker-workspace/chat/lead-social.module.css";
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
      backHref="/leads?tab=minha-fila"
      actions={<nav aria-label="Ações do lead" className={social.topActions}>
        <a href="#" className={social.topAction} data-tone="primary" aria-label="Abrir WhatsApp do cliente" onClick={(event) => { event.preventDefault(); setNotice("WhatsApp de demonstração não foi aberto"); }}><span className={social.topActionIcon} aria-hidden="true"><MessageCircle /></span><span>WhatsApp</span></a>
        <a href="#" className={social.topAction} aria-label="Ligar para o cliente" onClick={(event) => { event.preventDefault(); setNotice("Ligação de demonstração não foi iniciada"); }}><span className={social.topActionIcon} aria-hidden="true"><Phone /></span><span>Ligar</span></a>
        <button type="button" className={social.topAction} aria-label="Alterar etapa do lead" onClick={() => setNotice("Etapa de demonstração mantida")}><span className={social.topActionIcon} aria-hidden="true"><ClipboardList /></span><span>Etapa</span></button>
      </nav>}
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
