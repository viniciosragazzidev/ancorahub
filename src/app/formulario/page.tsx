import "@/components/arc/venancor-scope.css";

import type { Metadata } from "next";

import { DpoFooter } from "@/features/leads/lgpd/dpo-footer";
import { getPublicDpo } from "@/features/leads/lgpd/dpo-server";
import { PublicFormChat } from "@/features/public-form/components/public-form-chat";
import { publicFormConfig } from "@/features/public-form/intake";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Encontre seu plano de saúde | Âncora Saúde",
  description: "Responda até 7 perguntas rápidas e um corretor da Âncora te chama no WhatsApp.",
  robots: { index: false, follow: false },
};

/**
 * Formulário público de qualificação (23/11/2026), sem login: a conversa passo a passo do Lite. Sem a
 * fonte de captura configurada no Coolify (FORMULARIO_WEBHOOK_TOKEN), mostra que está fora do ar em vez de
 * deixar alguém responder tudo e não conseguir enviar. Em desenvolvimento, a conversa abre mesmo assim.
 * Com o encarregado de dados cadastrado (Configurações > Privacidade, 26/11), um rodapé curto fica embaixo.
 */
export default async function PublicFormPage() {
  if (!publicFormConfig() && process.env.NODE_ENV === "production") {
    return (
      <main className="arc-venancor grid min-h-dvh place-items-center bg-(--background) p-4">
        <section className="max-w-sm rounded-(--radius-panel) border border-(--border) bg-(--surface) p-6 text-center shadow-(--shadow-resting)">
          <h1 className="text-lg font-medium text-(--foreground)">O formulário volta em breve</h1>
          <p className="mt-2 text-sm leading-6 text-(--text-secondary)">Estamos ajustando esta página. Tente de novo mais tarde.</p>
        </section>
      </main>
    );
  }
  const dpo = await getPublicDpo();
  if (dpo) {
    return (
      <main className="arc-venancor grid h-dvh grid-rows-[minmax(0,1fr)_auto] bg-(--surface)">
        <div className="mx-auto h-full min-h-0 w-full max-w-2xl">
          <PublicFormChat fill />
        </div>
        <DpoFooter dpo={dpo} className="pb-[calc(env(safe-area-inset-bottom,0px)+12px)]" />
      </main>
    );
  }
  return (
    <main className="arc-venancor min-h-dvh bg-(--surface)">
      <div className="mx-auto max-w-2xl">
        <PublicFormChat />
      </div>
    </main>
  );
}
