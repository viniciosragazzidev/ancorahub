"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

import { SpreadsheetError, SpreadsheetLoading, SpreadsheetPasswordGate, SpreadsheetTable, type PublicSpreadsheet } from "../_components/spreadsheet-views";

type PublicData = PublicSpreadsheet;

export default function PublicSpreadsheetPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData(pwd?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/spreadsheets/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pwd ? { password: pwd } : {}),
      });

      if (res.status === 401) {
        const body = await res.json();
        if (body.needsPassword) {
          setNeedsPassword(true);
          setLoading(false);
          return;
        }
      }

      if (!res.ok) {
        const body = await res.json();
        if (res.status === 403) {
          setPasswordError(body.error ?? "Senha incorreta.");
          setLoading(false);
          return;
        }
        setError(body.error ?? "Erro ao carregar dados.");
        setLoading(false);
        return;
      }

      const result: PublicData = await res.json();
      setData(result);
      setNeedsPassword(false);
    } catch (e) {
      setError("Erro ao conectar com o servidor.");
    }
    setLoading(false);
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setSubmitting(true);
    fetchData(password).finally(() => setSubmitting(false));
  }

  // Visual Lite para todo mundo (Onda 8): os mesmos estados (carregando, erro, senha, tabela) e a mesma busca e ordenação.
  if (loading) return <SpreadsheetLoading />;
  if (error) return <SpreadsheetError message={error} />;
  if (needsPassword) {
    return <SpreadsheetPasswordGate password={password} onPasswordChange={setPassword} error={passwordError} submitting={submitting} onSubmit={handlePasswordSubmit} />;
  }
  if (!data) return null;
  return <SpreadsheetTable data={data} />;
}
