"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ActionResult<T> = ({ success: true } & T) | { success: false; error: string };

export type MaterialGroupRow = {
  id: string;
  groupId: string;
  groupName: string | null;
  active: boolean;
};

export type MaterialGroupActions = {
  refresh: () => Promise<ActionResult<{ groupsFound: number }>>;
  toggle: (input: { id: string; active: boolean }) => Promise<ActionResult<object>>;
};

/** Lowercase, no accents: "Cotação" finds "cotacao". */
function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
}

export function MaterialGroupsCard({
  groups,
  channelReady,
  actions,
}: {
  groups: MaterialGroupRow[];
  channelReady: boolean;
  actions: MaterialGroupActions;
}) {
  const router = useRouter();
  const activeCount = groups.filter((group) => group.active).length;
  // "Only active" by default, but with none active the list would be empty and there would be nothing to pick.
  const [onlyActive, setOnlyActive] = useState(activeCount > 0);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const needle = fold(query.trim());
    return groups.filter((group) => {
      if (onlyActive && !group.active) return false;
      return !needle || fold(group.groupName ?? group.groupId).includes(needle);
    });
  }, [groups, onlyActive, query]);

  function refresh() {
    startTransition(async () => {
      const result = await actions.refresh();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.groupsFound === 1 ? "1 grupo encontrado." : `${result.groupsFound} grupos encontrados.`);
      router.refresh();
    });
  }

  function toggle(group: MaterialGroupRow) {
    setBusyId(group.id);
    startTransition(async () => {
      const result = await actions.toggle({ id: group.id, active: !group.active });
      setBusyId(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(group.active ? "Grupo desativado." : "Grupo ativado para captura.");
      router.refresh();
    });
  }

  return (
    <Card variant="overview" className="shadow-sm">
      <CardHeader className="gap-2 border-b border-border/70 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Grupos para captura</CardTitle>
            <CardDescription className="mt-1 max-w-2xl leading-5">
              Escolha de quais grupos o sistema lê PDFs e imagens de tabelas. Grupos novos começam desativados.
              {groups.length > 0 ? ` ${activeCount} de ${groups.length} ativos.` : ""}
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" disabled={!channelReady || isPending} onClick={refresh}>
            {isPending && busyId === null ? "Atualizando…" : "Atualizar lista de grupos"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 px-5 py-4">
        {!channelReady ? (
          <p className="text-sm text-muted-foreground">Conecte o número acima para listar os grupos em que ele está.</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum grupo listado ainda. Use “Atualizar lista de grupos” para buscar os grupos do número.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                aria-label="Buscar grupo"
                placeholder="Buscar grupo…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="max-w-xs"
              />
              <Button size="sm" variant="ghost" onClick={() => setOnlyActive((value) => !value)}>
                {onlyActive ? "Mostrar todos" : "Só ativos"}
              </Button>
            </div>

            {visible.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {onlyActive ? "Nenhum grupo ativo com essa busca." : "Nenhum grupo com essa busca."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">{group.groupName ?? "Grupo sem nome"}</TableCell>
                      <TableCell>
                        <Badge variant={group.active ? "default" : "outline"}>{group.active ? "Ativo" : "Inativo"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => toggle(group)}
                          aria-label={`${group.active ? "Desativar" : "Ativar"} ${group.groupName ?? "grupo"}`}
                        >
                          {busyId === group.id ? "Salvando…" : group.active ? "Desativar" : "Ativar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
