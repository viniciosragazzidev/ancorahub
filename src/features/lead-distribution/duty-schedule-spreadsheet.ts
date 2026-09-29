import * as XLSX from "xlsx";

import type { getDutyScheduleProfile } from "./duty-schedule-profile-queries";
import { getDutyLeadShift } from "./duty-leads-shift-groups";

type DutyScheduleProfile = Awaited<ReturnType<typeof getDutyScheduleProfile>>;

export type DutyScheduleSpreadsheetInput = {
  scheduleName: string;
  leads: DutyScheduleProfile["leads"];
};

const BORDER = { style: "thin", color: { rgb: "808080" } } as const;
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER } as const;

function safeCell(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function channelLabel(lead: DutyScheduleProfile["leads"][number]) {
  const channel = lead.sourceChannel.toLowerCase();
  if (lead.tipo.toUpperCase() === "PME" && channel.includes("facebook")) return "PME FACEBOOK";
  if (channel.includes("facebook")) return "FACEBOOK";
  if (channel.includes("whatsapp")) return "WhatsApp Externo";
  if (channel.includes("telefone") || lead.origem === "manual") return "TELEFONE";
  return lead.sourceChannel || lead.origem;
}

function brokerCodeFromName(name: string | null) {
  return name?.match(/(\d+)\s*$/)?.[1] ?? "";
}

function sortAssignedLeads<T extends { assignedAt: Date | null; createdAt: Date; id: string }>(leads: T[]) {
  return [...leads].sort((a, b) =>
    (a.assignedAt?.getTime() ?? Number.POSITIVE_INFINITY) - (b.assignedAt?.getTime() ?? Number.POSITIVE_INFINITY)
    || a.createdAt.getTime() - b.createdAt.getTime()
    || a.id.localeCompare(b.id),
  );
}

export function encodeDutyScheduleSpreadsheet(input: DutyScheduleSpreadsheetInput) {
  const title = `PLANTÃO ${input.scheduleName}`.toUpperCase();
  // This export represents the handoff to brokers: waiting/unassigned leads
  // are intentionally omitted and assignment time defines the order.
  const assignedLeads = sortAssignedLeads(input.leads.filter((lead) => Boolean(lead.corretorId && lead.assignedAt)));
  const morningLeads = assignedLeads.filter((lead) => getDutyLeadShift(lead) === "manha");
  const afternoonLeads = assignedLeads.filter((lead) => getDutyLeadShift(lead) === "tarde");
  const rows: Array<Array<string>> = [
    [title, "", "", "", "", ""],
    ["CÓDIGO", "CORRETOR", "CANAL", "CLIENTE", "TELEFONE", "E-MAIL"],
  ];
  const sectionRows = new Set<number>();
  const appendShift = (label: string, leads: typeof assignedLeads) => {
    if (!leads.length) return;
    sectionRows.add(rows.length);
    rows.push([label, "", "", "", "", ""]);
    for (const lead of leads) {
      rows.push([
        safeCell(brokerCodeFromName(lead.brokerName)),
        safeCell(lead.brokerName ?? "Sem corretor"),
        safeCell(channelLabel(lead)),
        safeCell(lead.nome),
        safeCell(lead.telefone),
        safeCell(lead.email),
      ]);
    }
  };
  appendShift("MANHÃ", morningLeads);
  appendShift("TARDE", afternoonLeads);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
  sheet["!freeze"] = { xSplit: 0, ySplit: 2 };
  sheet["!autofilter"] = { ref: `A2:F${Math.max(rows.length, 2)}` };
  sheet["!cols"] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 20 },
    { wch: 30 },
    { wch: 18 },
    { wch: 32 },
  ];
  sheet["!rows"] = [{ hpt: 28 }, { hpt: 22 }];

  for (let column = 0; column < 6; column += 1) {
    const titleCell = XLSX.utils.encode_cell({ r: 0, c: column });
    const headerCell = XLSX.utils.encode_cell({ r: 1, c: column });
    sheet[titleCell].s = {
      font: { name: "Arial", sz: 16, bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      border: ALL_BORDERS,
    };
    sheet[headerCell].s = {
      font: { name: "Arial", sz: 11, bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      border: ALL_BORDERS,
    };
  }

  for (let row = 2; row < rows.length; row += 1) {
    if (sectionRows.has(row)) {
      sheet["!merges"]?.push({ s: { r: row, c: 0 }, e: { r: row, c: 5 } });
      for (let column = 0; column < 6; column += 1) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
        cell.s = {
          font: { name: "Arial", sz: 11, bold: true },
          alignment: { horizontal: "left", vertical: "center" },
          border: ALL_BORDERS,
          fill: { fgColor: { rgb: "D9EAF7" } },
        };
      }
      continue;
    }
    for (let column = 0; column < 6; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      cell.s = {
        font: { name: "Arial", sz: 10 },
        alignment: { horizontal: column === 0 || column === 2 ? "center" : "left", vertical: "center" },
        border: ALL_BORDERS,
      };
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Plantão");
  return new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx", cellStyles: true }));
}
