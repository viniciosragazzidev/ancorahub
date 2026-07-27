import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function RouteNotFound({
  title = "Página não encontrada",
  description = "O endereço pode ter sido removido ou você não tem acesso a este registro.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center px-4 py-12" aria-labelledby="not-found-title">
      <Card className="w-full">
        <CardHeader>
          <CardTitle id="not-found-title">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link className={buttonVariants()} href="/dashboard">Voltar ao painel</Link>
          <Link className={cn(buttonVariants({ variant: "outline" }))} href="/leads">Abrir leads</Link>
        </CardContent>
      </Card>
    </main>
  );
}
