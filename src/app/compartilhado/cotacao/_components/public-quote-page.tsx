import { FileArrowDown, WhatsappLogo } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card } from "@/components/ui/card";
import type { PublicQuoteView } from "@/features/auto-sale/public-quote-view";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2" aria-label={title}>
      <h2 className="text-base font-medium">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Página pública da cotação (DEC-182): o cliente abre pelo link do WhatsApp, sem login. Um CTA primário
 * (responder no WhatsApp); o PDF é ação secundária. Mobile primeiro, tokens e componentes do sistema.
 */
export function PublicQuotePage({ view, pdfHref }: { view: PublicQuoteView; pdfHref: string }) {
  // O app trava a rolagem do documento: a página rola no próprio contêiner (como a planilha compartilhada).
  return (
    <div className="h-dvh overflow-y-auto bg-background">
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8 sm:py-12">
      <header className="grid gap-1">
        <p className="text-sm text-muted-foreground">{view.brokerageName}</p>
        <h1 className="text-2xl font-medium tracking-tight">{view.firstName ? `${view.firstName}, sua cotação de plano de saúde` : "Sua cotação de plano de saúde"}</h1>
        <p className="text-sm text-muted-foreground">Emitida em {view.issuedAt}. Válida até {view.validUntil}.</p>
        <p className="text-sm text-muted-foreground">{view.profile}</p>
      </header>

      {view.relaxedNote || view.savingsNote ? (
        <p className="rounded-[var(--radius-card)] border border-border bg-muted/40 p-3 text-sm">{[view.relaxedNote, view.savingsNote].filter(Boolean).join(" ")}</p>
      ) : null}

      <Section title="Opções para você">
        <ul className="grid gap-3 sm:grid-cols-3">
          {view.plans.map((plan, index) => (
            <li key={plan.id}>
              <Card className={`grid h-full gap-2 p-4 ${plan.recommended ? "border-primary ring-1 ring-primary" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Opção {index + 1}</span>
                  {plan.recommended ? <Badge variant="info">Recomendado</Badge> : null}
                </div>
                <div>
                  <p className="font-medium">{plan.operator}</p>
                  <p className="text-sm text-muted-foreground">{plan.name}</p>
                </div>
                <p className="text-xl font-medium tabular-nums">{plan.total}<span className="text-sm font-normal text-muted-foreground"> por mês</span></p>
                <p className="text-sm">{plan.coparticipation}</p>
                <p className="text-sm text-muted-foreground">{plan.accommodation}</p>
                <ul className="grid gap-0.5 text-xs tabular-nums text-muted-foreground">
                  {plan.perLife.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </Card>
            </li>
          ))}
        </ul>
        {view.pendingNote ? <p className="text-xs text-muted-foreground">{view.pendingNote}</p> : null}
      </Section>

      {view.recommendationReason ? (
        <Section title="Nossa recomendação">
          <p className="text-sm leading-6">{view.recommendationReason}</p>
        </Section>
      ) : null}

      {view.network ? (
        <Section title={view.network.title}>
          <ul className="grid gap-1 text-sm">{view.network.units.map((unit) => <li key={unit}>{unit}</li>)}</ul>
        </Section>
      ) : null}

      <Section title="Carências, em linguagem simples">
        <p className="text-sm leading-6 text-muted-foreground">Urgência e emergência: 24 horas. Cirurgia eletiva: até 180 dias. Parto: 300 dias. Consultas e exames: conforme o contrato da operadora.</p>
      </Section>

      {view.promotions.length ? (
        <Section title="Condição vigente">
          <ul className="grid gap-1 text-sm">{view.promotions.map((promotion) => <li key={promotion}>{promotion}</li>)}</ul>
        </Section>
      ) : null}

      <Section title="Para contratar">
        <ul className="grid list-disc gap-1 pl-5 text-sm">{view.documents.map((item) => <li key={item}>{item}</li>)}</ul>
        <p className="text-sm font-medium">{view.nextStep}</p>
      </Section>

      <div className="flex flex-col gap-2 sm:flex-row">
        {/* Links com as classes do Button: componente de servidor, sem o `render` do botão de cliente. */}
        {view.whatsappUrl ? (
          <a className={buttonVariants({ size: "lg" })} href={view.whatsappUrl} target="_blank" rel="noreferrer"><WhatsappLogo className="size-4" /> Responder no WhatsApp</a>
        ) : null}
        <a className={buttonVariants({ size: "lg", variant: "outline" })} href={pdfHref} target="_blank" rel="noreferrer"><FileArrowDown className="size-4" /> Baixar o PDF</a>
      </div>

      <footer className="grid gap-1 border-t border-border pt-4 text-xs text-muted-foreground">
        <p>{view.brokerageName}{view.units.length ? `. Unidades: ${view.units.join(", ")}.` : ""}</p>
        <p>{view.legal}</p>
      </footer>
    </main>
    </div>
  );
}
