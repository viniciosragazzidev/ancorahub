"use client";

import { useState } from "react";

import { SpreadsheetError, SpreadsheetPasswordGate, SpreadsheetTable, type PublicSpreadsheet } from "@/app/compartilhado/_components/spreadsheet-views";
import { RouteError } from "@/components/route-error";

const NAMES = ["Justiniano Albuquerque de Souza", "Padaria Nova Esperança Ltda", "Cristiane Farizele Monteiro", "Bartolomeu Wanderley Castelo Branco", "Nazareth Gonçalves Pereira", "Clínica Odontológica Sorriso Pleno", "Ana", "Maximiliano Cavalcanti Rocha"];

const SHEET: PublicSpreadsheet = {
  name: "Leads Meta de outubro (Barra e Niterói)",
  description: "Base compartilhada com a coordenação comercial. Atualizada às 18h.",
  columns: [
    { key: "nome", label: "Nome", type: "string" },
    { key: "telefone", label: "Telefone", type: "string" },
    { key: "operadora", label: "Operadora", type: "string" },
    { key: "vidas", label: "Vidas", type: "number" },
    { key: "valor", label: "Valor mensal", type: "number" },
    { key: "entrada", label: "Entrada", type: "date" },
  ],
  rows: Array.from({ length: 42 }, (_, index) => ({
    nome: NAMES[index % NAMES.length],
    telefone: `(21) 9${String(8000 + index * 37).padStart(4, "0")}-${String(1000 + index * 53).slice(-4)}`,
    operadora: ["Amil", "Bradesco Saúde", "SulAmérica", "Unimed Rio", ""][index % 5],
    vidas: (index % 6) + 1,
    valor: 642.9 * ((index % 6) + 1),
    entrada: `${String((index % 28) + 1).padStart(2, "0")}/10/2026`,
  })),
  rowCount: 42,
};

/** Estados de cliente das telas públicas (planilha e erro) para os prints da Onda 8. */
export function PublicFixtureClient({ screen }: { screen: string }) {
  const [password, setPassword] = useState("");
  if (screen === "planilha") return <SpreadsheetTable data={SHEET} />;
  if (screen === "planilha-senha") {
    return <SpreadsheetPasswordGate password={password} onPasswordChange={setPassword} error="Senha incorreta." submitting={false} onSubmit={(event) => event.preventDefault()} />;
  }
  if (screen === "planilha-erro") return <SpreadsheetError message="Este link expirou ou foi desativado por quem compartilhou." />;
  return <RouteError standalone error={Object.assign(new Error("Falha ao carregar os dados de exemplo"), { digest: "4127703921" })} reset={() => undefined} />;
}
