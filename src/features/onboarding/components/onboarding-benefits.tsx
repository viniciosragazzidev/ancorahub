import { CheckCircle } from "@/components/huge-icons"

const BENEFITS = [
  "Organize filiais e equipes",
  "Centralize a operação comercial",
  "Acompanhe o progresso da configuração",
  "Prepare o ambiente para receber leads",
]

export function OnboardingBenefits() {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Benefícios
      </h3>
      <ul className="flex flex-col gap-2">
        {BENEFITS.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2.5">
            <CheckCircle
              weight="fill"
              className="mt-0.5 size-4 shrink-0 text-ct-blue"
            />
            <span className="text-base leading-snug text-foreground/85">
              {benefit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
