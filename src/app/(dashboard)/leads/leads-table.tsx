"use client";

import { ArrowUpRight, Phone } from "@/components/huge-icons";
import { motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";

export type LeadRow = {
  id: string;
  nome: string;
  telefone: string;
  status: string;
  origem: string;
  createdAt: string;
  corretorNome: string | null;
};

import { maskPhone } from "@/features/quotes/utils";
import { LeadStatusBadge } from "@/components/status-badges";

export function LeadsTableBody({ leads, contextRole }: { leads: LeadRow[]; contextRole: string }) {
  return (
    <motion.tbody initial="hidden" animate="visible">
      {leads.map((lead, index) => (
        <motion.tr
          key={lead.id}
          custom={index}
          variants={{
            hidden: { opacity: 0, x: -8 },
            visible: (rowIndex: number) => ({
              opacity: 1,
              x: 0,
              transition: { duration: 0.15, ease: [0, 0, 0.2, 1], delay: Math.min(rowIndex * 0.03, 0.25) },
            }),
          }}
        >
          <TableCell className="pl-5">
            <p className="font-medium">{lead.nome}</p>
            <p className="text-xs text-muted-foreground">{contextRole === "broker" && lead.status === "distributed" ? maskPhone(lead.telefone) : lead.telefone}</p>
          </TableCell>
          <TableCell>
            <div className="flex flex-wrap items-center gap-1.5">
              <LeadStatusBadge status={lead.status} />
              {isActiveServiceStatus(lead.status) ? <Badge className="border-emerald-500/15 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/15" variant="outline">Atendimento ativo</Badge> : null}
            </div>
          </TableCell>
          <TableCell>{lead.origem === "manual" ? "Manual" : "Webhook"}</TableCell>
          <TableCell>
            {lead.corretorNome ? <span className="flex flex-col"><span>{lead.corretorNome}</span>{isActiveServiceStatus(lead.status) ? <span className="text-xs text-emerald-300">Atendendo agora</span> : null}</span> : "Aguardando distribuicao"}
          </TableCell>
          <TableCell className="text-muted-foreground">{new Intl.DateTimeFormat("pt-BR").format(new Date(lead.createdAt))}</TableCell>
          <TableCell className="pr-5 text-right">
            <div className="flex justify-end gap-1.5">
              {!(contextRole === "broker" && lead.status === "distributed") ? <Button aria-label={`Ligar para ${lead.nome}`} render={<a href={`tel:${lead.telefone}`} />} size="icon-sm" variant="ghost"><Phone size={15} /></Button> : null}
              <Button render={<a href={`/leads/${lead.id}`} />} size="sm" variant="outline">Abrir <ArrowUpRight size={14} /></Button>
            </div>
          </TableCell>
        </motion.tr>
      ))}
    </motion.tbody>
  );
}

function isActiveServiceStatus(status: string) {
  return ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(status);
}

