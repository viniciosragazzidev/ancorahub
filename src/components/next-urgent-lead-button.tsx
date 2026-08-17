import Link from "next/link";
import { Lightning } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getUrgentLeadForUser } from "@/features/leads/queries";

export type UrgentLeadData = Awaited<ReturnType<typeof getUrgentLeadForUser>>;

export async function NextUrgentLeadButton({ lead }: { lead?: UrgentLeadData }) {
  const urgentLead = lead ?? (await getUrgentLeadForUser().catch(() => null));

  if (!urgentLead) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              render={<Link href={`/leads/${urgentLead.id}`} />}
              size="sm"
              className="shrink-0 gap-1.5 border border-amber-500/25 bg-amber-500/10 text-[11px] font-semibold uppercase text-amber-700 hover:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
            >
              <Lightning className="size-3.5 shrink-0 text-amber-500" />
              <span className="truncate tracking-wide">Próximo lead</span>
            </Button>
          }
        />
        <TooltipContent side="bottom" className="text-xs">
          <p className="font-semibold">{urgentLead.nome}</p>
          <p className="text-[11px] text-muted-foreground">{urgentLead.urgentReason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
