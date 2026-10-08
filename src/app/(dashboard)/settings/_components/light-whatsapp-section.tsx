/** WhatsApp pessoal of the broker app: what the connection is for and where to set it up. */
export function LightWhatsappSection() {
  return (
    <section aria-labelledby="whatsapp-heading" className="arc-venancor flex flex-col gap-4 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <div>
        <h2 id="whatsapp-heading" className="text-base font-semibold text-(--foreground)">WhatsApp pessoal de atendimento</h2>
        <p className="mt-1 text-sm text-(--text-secondary)">
          Conecte somente o número que você usa no atendimento. A conexão é isolada por usuário e não altera a identidade da corretora.
        </p>
      </div>
      <a
        href="/integrations/whatsapp"
        className="inline-flex h-11 items-center justify-center rounded-full bg-(--accent) px-5 text-sm font-semibold text-(--accent-foreground)"
      >
        Configurar meu WhatsApp
      </a>
    </section>
  );
}
