import Link from "next/link";
import { Books, Receipt } from "@phosphor-icons/react/ssr";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ToolEntry = {
  name: string;
  description: string;
  href: string;
  icon: typeof Receipt;
  /** Shown only to the director. */
  directorOnly?: boolean;
};

export const toolEntries: ToolEntry[] = [
  {
    name: "Validador de Comprovante",
    description:
      "Confere o comprovante de pagamento contra a proposta e o boleto antes de liberar adiantamento ao corretor.",
    href: "/ferramentas/validador-comprovante",
    icon: Receipt,
  },
  {
    name: "Materiais das operadoras",
    description:
      "Importa tabelas, manuais, redes e cotações das operadoras e cataloga cada informação por operadora, plano e área para a Cotação Express.",
    href: "/ferramentas/materiais-operadoras",
    icon: Books,
    directorOnly: true,
  },
];

function ToolTile({ tool }: { tool: ToolEntry }) {
  const Icon = tool.icon;
  return (
    <Link
      aria-label={`Abrir ${tool.name}`}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      href={tool.href}
    >
      <Card
        variant="compact"
        className="h-full cursor-pointer transition-colors duration-150 hover:border-primary/50 hover:bg-muted/40"
      >
        <CardHeader className="gap-3 pb-0">
          <div className="flex items-start justify-between gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-border bg-muted/50 text-primary">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <Badge variant="success">Disponível</Badge>
          </div>
          <CardTitle>{tool.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="leading-5">{tool.description}</CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}

export function ToolsCatalog({ isDirector = false }: { isDirector?: boolean }) {
  return (
    <section aria-label="Ferramentas disponíveis" className="mx-auto w-full max-w-6xl">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {toolEntries.filter((tool) => isDirector || !tool.directorOnly).map((tool) => (
          <ToolTile key={tool.href} tool={tool} />
        ))}
      </div>
    </section>
  );
}
