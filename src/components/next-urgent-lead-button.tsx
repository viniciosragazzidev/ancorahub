import Link from "next/link";
import { Lightning } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getUrgentLeadForUser } from "@/features/leads/queries";

export async function NextUrgentLeadButton() {
  const urgentLead = await getUrgentLeadForUser().catch(() => null);

  if (!urgentLead) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Button
            render={<Link href={`/leads/${urgentLead.id}`} />}
            className="h-9 gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 text-[11px] font-semibold uppercase text-amber-700 transition-[background-color,border-color,color] hover:border-amber-500/40 hover:bg-amber-500/15 dark:text-amber-400"
          >
            <Lightning className="size-4 shrink-0 text-amber-500" />
            <span className="truncate tracking-wide">Próximo lead</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p className="font-semibold">{urgentLead.nome}</p>
          <p className="text-[11px] text-muted-foreground">{urgentLead.urgentReason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
