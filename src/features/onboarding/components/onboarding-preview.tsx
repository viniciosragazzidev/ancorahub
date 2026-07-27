import { Buildings, Handshake, Users } from "@/components/huge-icons"

export function OnboardingPreview() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-b from-card to-muted/40 p-5">
      {/* Mock dashboard header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-ct-blue" />
          <span className="text-[11px] font-medium text-muted-foreground">
            Visão geral
          </span>
        </div>
        <div className="flex -space-x-1">
          <div className="size-5 rounded-full border-2 border-card bg-muted" />
          <div className="size-5 rounded-full border-2 border-card bg-muted" />
        </div>
      </div>

      {/* Mock KPI cards */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          { label: "Filiais", icon: Buildings, value: "—" },
          { label: "Equipe", icon: Users, value: "—" },
          { label: "Leads", icon: Handshake, value: "—" },
        ].map(({ label, icon: Icon, value }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-border/60 bg-card/50 p-3"
          >
            <Icon className="size-4 text-muted-foreground/60" weight="regular" />
            <span className="text-lg font-semibold tabular-nums text-foreground/40">
              {value}
            </span>
            <span className="text-[10px] text-muted-foreground/50">{label}</span>
          </div>
        ))}
      </div>

      {/* Mock progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/50">
            Configuração
          </span>
          <span className="text-[10px] font-medium text-muted-foreground/50">
            0%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-0 rounded-full bg-muted-foreground/20" />
        </div>
      </div>

      {/* Decorative dots */}
      <div className="mt-4 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="size-1.5 rounded-full bg-muted-foreground/10"
          />
        ))}
        <div className="ml-auto text-[10px] text-muted-foreground/30">
          CorreTop
        </div>
      </div>
    </div>
  )
}
