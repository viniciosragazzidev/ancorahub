import Link from "next/link";

import { Globe, LinkSimple, Megaphone, Plug, WhatsappLogo } from "@/components/huge-icons";
import { VoxelIllustration } from "@/components/illustrations/voxel-illustration";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type IntegrationCard = {
  name: string;
  description: string;
  href?: string;
  icon: typeof Globe;
  status: "available" | "planned";
};

export const integrationCatalogEntries: IntegrationCard[] = [
  {
    name: "Meta Business",
    description: "Configure a captação de formulários Meta e acompanhe as Páginas que alimentam a operação.",
    href: "/integrations/meta",
    icon: Globe,
    status: "available",
  },
  {
    name: "Facebook Lead Ads",
    description: "Receba formulários de anúncios diretamente na fila central da empresa.",
    href: "/integrations/meta",
    icon: Megaphone,
    status: "available",
  },
  {
    name: "WhatsApp oficial",
    description: "Conecte o número corporativo para atendimento, templates e notificações.",
    href: "/integrations/whatsapp",
    icon: WhatsappLogo,
    status: "available",
  },
  {
    name: "Formulários e site",
    description: "Crie fontes de captura para landing pages, formulários próprios e pixels.",
    href: "/settings?tab=integracoes",
    icon: LinkSimple,
    status: "available",
  },
  {
    name: "Instagram",
    description: "Conecte mensagens, campanhas e formulários quando este conector estiver disponível.",
    icon: Globe,
    status: "planned",
  },
  {
    name: "Outros conectores",
    description: "Novas integrações de marketing, atendimento e operação aparecerão aqui.",
    icon: Plug,
    status: "planned",
  },
];

function IntegrationTile({ integration }: { integration: IntegrationCard }) {
  const Icon = integration.icon;
  const content = (
    <Card
      variant="compact"
      className={
        integration.status === "available"
          ? "h-full cursor-pointer transition-all duration-150 hover:border-primary/50 hover:bg-muted/40 hover:shadow-xs active:scale-[0.99]"
          : "h-full border-dashed opacity-75"
      }
    >
      <CardHeader className="gap-3 pb-0">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-10 place-items-center rounded-xl border border-border bg-muted/50 text-foreground">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <Badge variant={integration.status === "available" ? "success" : "secondary"}>
            {integration.status === "available" ? "Disponível" : "Em breve"}
          </Badge>
        </div>
        <CardTitle>{integration.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="leading-5">{integration.description}</CardDescription>
      </CardContent>
    </Card>
  );

  if (!integration.href) {
    return <div aria-disabled="true" className="h-full">{content}</div>;
  }

  return (
    <Link
      aria-label={`Abrir integração ${integration.name}`}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      href={integration.href}
    >
      {content}
    </Link>
  );
}

export function IntegrationsCatalog() {
  return (
    <section aria-labelledby="integrations-catalog-title" className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/60 px-4 py-3 sm:px-5">
        <div className="max-w-2xl">
          <h2 id="integrations-catalog-title" className="text-lg font-semibold tracking-tight">Integrações</h2>
          <p className="mt-1 text-sm text-muted-foreground">Conecte os canais que fazem parte da sua operação. Cada integração abre uma área própria de configuração e acompanhamento.</p>
        </div>
        <VoxelIllustration className="hidden size-20 shrink-0 sm:block" name="integration-hub" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {integrationCatalogEntries.map((integration) => (
          <IntegrationTile integration={integration} key={integration.name} />
        ))}
      </div>
    </section>
  );
}
