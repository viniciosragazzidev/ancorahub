import * as XLSX from "xlsx";

import type { getDutyScheduleProfile } from "./duty-schedule-profile-queries";

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

export function encodeDutyScheduleSpreadsheet(input: DutyScheduleSpreadsheetInput) {
  const title = `PLANTÃO ${input.scheduleName}`.toUpperCase();
  const rows = [
    [title, "", "", "", "", ""],
    ["CÓDIGO", "CORRETOR", "CANAL", "CLIENTE", "TELEFONE", "E-MAIL"],
    ...input.leads.map((lead) => [
      safeCell(lead.externalId ?? lead.id),
      safeCell(lead.brokerName ?? "Sem corretor"),
      safeCell(channelLabel(lead)),
      safeCell(lead.nome),
      safeCell(lead.telefone),
      safeCell(lead.email),
    ]),
  ];

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
