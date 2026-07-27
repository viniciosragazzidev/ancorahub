"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Branch = { id: string; name: string };

export function LeadsFilters({ initialSearch, initialStatus, initialBranch, initialTipo, branches }: { initialSearch?: string; initialStatus?: string; initialBranch?: string; initialTipo?: string; branches: Branch[] }) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch ?? "");
  const [status, setStatus] = useState(initialStatus ?? "");
  const [branch, setBranch] = useState(initialBranch ?? "");
  const [tipo, setTipo] = useState(initialTipo ?? "");

  function submitCurrent() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (branch) params.set("branch", branch);
    if (tipo) params.set("tipo", tipo);
    router.push(`/leads${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return <div className="grid gap-2">
    <form className="flex w-full flex-col gap-2 sm:flex-row" method="get" onSubmit={(e) => { e.preventDefault(); submitCurrent(); }}>
      <Input aria-label="Buscar leads" className="h-8 flex-1 bg-muted" name="search" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou telefone" value={search} />
      <select aria-label="Status" className="h-8 rounded-lg border border-input bg-muted px-2 text-sm" name="status" onChange={(event) => setStatus(event.target.value)} value={status}><option value="">Todos os status</option><option value="new">Novos</option><option value="distributed">Distribuídos</option><option value="in_contact">Em atendimento</option><option value="converted">Convertidos</option><option value="lost">Perdidos</option></select>
      <select aria-label="Tipo" className="h-8 rounded-lg border border-input bg-muted px-2 text-sm" name="tipo" onChange={(event) => setTipo(event.target.value)} value={tipo}><option value="">Todos os tipos</option><option value="PF">PF (Física)</option><option value="PME">PME (Jurídica)</option></select>
      {branches.length ? <select aria-label="Filial" className="h-8 rounded-lg border border-input bg-muted px-2 text-sm" name="branch" onChange={(event) => setBranch(event.target.value)} value={branch}><option value="">Todas as filiais</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : null}
      <Button size="sm" type="submit" variant="outline">Aplicar</Button>
    </form>
  </div>;
}
