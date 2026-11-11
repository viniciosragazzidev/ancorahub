"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { fold } from "../engine";

export type CidadeComboboxProps = {
  cidades: string[];
  populares: string[];
  valor: string;
  obrigatorio: boolean;
  onEscolher: (cidade: string) => void;
};

/** Filtro sem acento e sem diferença de caixa: "sao" acha "São Paulo". */
export function cidadeCombina(cidade: string, busca: string) {
  return fold(cidade).includes(fold(busca)) ? 1 : 0;
}

/**
 * Parte o texto em trechos e marca o que casa com a busca, sem acento e sem caixa.
 * Mapeia cada caractere para a sua forma dobrada, para o destaque cair no lugar certo no original.
 */
export function partesDestacadas(texto: string, busca: string): { trecho: string; marcado: boolean }[] {
  const termo = fold(busca);
  if (!termo) return [{ trecho: texto, marcado: false }];
  const caracteres = [...texto];
  let dobrado = "";
  const origem: number[] = [];
  caracteres.forEach((caractere, indice) => {
    const forma = fold(caractere);
    for (let k = 0; k < forma.length; k++) {
      dobrado += forma[k];
      origem.push(indice);
    }
  });
  const posicao = dobrado.indexOf(termo);
  if (posicao < 0) return [{ trecho: texto, marcado: false }];
  const inicio = origem[posicao];
  const fim = origem[posicao + termo.length - 1] + 1;
  return [
    { trecho: caracteres.slice(0, inicio).join(""), marcado: false },
    { trecho: caracteres.slice(inicio, fim).join(""), marcado: true },
    { trecho: caracteres.slice(fim).join(""), marcado: false },
  ].filter(parte => parte.trecho.length > 0);
}

/** Lista pesquisável de municípios (cmdk): teclado com setas, Enter e Esc, busca sem acento. */
function ListaCidades({ cidades, valor, onEscolher }: { cidades: string[]; valor: string; onEscolher: (cidade: string) => void }) {
  const [busca, setBusca] = useState("");
  return (
    <Command filter={cidadeCombina} className="bg-transparent">
      <CommandInput
        placeholder="Buscar município"
        aria-label="Buscar município"
        value={busca}
        onValueChange={setBusca}
        className="h-12 text-base"
      />
      <CommandList className="max-h-72">
        <CommandEmpty>Nenhum município encontrado</CommandEmpty>
        <CommandGroup>
          {cidades.map(cidade => (
            <CommandItem
              key={cidade}
              value={cidade}
              onSelect={() => onEscolher(cidade)}
              className="min-h-11 gap-3 text-sm"
            >
              <span className="min-w-0 flex-1 break-words">
                {partesDestacadas(cidade, busca).map((parte, indice) =>
                  parte.marcado ? <mark key={indice} className="rounded-sm bg-primary/15">{parte.trecho}</mark> : <span key={indice}>{parte.trecho}</span>,
                )}
              </span>
              {valor === cidade ? <Check aria-hidden strokeWidth={2} className="size-4 shrink-0 text-primary" /> : null}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

/**
 * Município com busca. No desktop, Popover com a lista; no celular, a mesma lista num Drawer.
 * Os atalhos de cidades com mais planos ficam acima do campo.
 */
export function CidadeCombobox({ cidades, populares, valor, obrigatorio, onEscolher }: CidadeComboboxProps) {
  const [aberto, setAberto] = useState(false);
  const mobile = useIsMobile();
  const gatilho = (
    <>
      <span className={`min-w-0 flex-1 truncate ${valor ? "" : "text-muted-foreground"}`}>
        {valor || "Escolha o município"}
      </span>
      <ChevronsUpDown aria-hidden strokeWidth={1.5} className="size-4 shrink-0 text-muted-foreground" />
    </>
  );
  const classeGatilho = "flex min-h-12 w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-left text-sm transition-colors hover:bg-muted";

  function escolher(cidade: string) {
    onEscolher(cidade);
    setAberto(false);
  }

  return (
    <div className="grid gap-3">
      <p id="municipio-rotulo" className="text-sm font-medium">
        Município de comercialização{obrigatorio ? "" : " (opcional)"}
      </p>
      {populares.length > 0 ? (
        <ul aria-label="Cidades com mais planos" className="flex flex-wrap gap-2">
          {populares.map(cidade => (
            <li key={cidade}>
              <button
                type="button"
                aria-pressed={valor === cidade}
                onClick={() => onEscolher(cidade)}
                className={`min-h-9 rounded-full border px-3 text-sm transition-colors ${valor === cidade ? "border-primary bg-primary/5 font-medium" : "border-border bg-background hover:bg-muted"}`}
              >
                {cidade}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {mobile ? (
        <>
          <button type="button" aria-labelledby="municipio-rotulo" aria-haspopup="dialog" onClick={() => setAberto(true)} className={classeGatilho}>
            {gatilho}
          </button>
          <Drawer open={aberto} onOpenChange={setAberto}>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Município de comercialização</DrawerTitle>
                <DrawerDescription>Busque pelo nome da cidade e toque para escolher.</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-6">
                <ListaCidades cidades={cidades} valor={valor} onEscolher={escolher} />
              </div>
            </DrawerContent>
          </Drawer>
        </>
      ) : (
        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverTrigger
            aria-labelledby="municipio-rotulo"
            render={<button type="button" className={classeGatilho} />}
          >
            {gatilho}
          </PopoverTrigger>
          <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-2">
            <ListaCidades cidades={cidades} valor={valor} onEscolher={escolher} />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
