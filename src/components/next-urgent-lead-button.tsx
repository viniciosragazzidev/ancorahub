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
            size="sm"
            variant="default"
            render={<Link href={`/leads/${urgentLead.id}`} />}
            className="h-8 gap-1.5 px-3 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-xs transition-all animate-pulse"
          >
            <Lightning className="size-3.5 fill-current" />
            <span>Próximo lead</span>
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
