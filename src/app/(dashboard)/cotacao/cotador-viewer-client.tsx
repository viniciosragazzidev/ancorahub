import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowSquareOut, ShieldCheck, SlidersHorizontal } from "@/components/huge-icons";

export function CotadorViewerClient() {
  const targetUrl = "https://cotadorsimplificado.com.br/";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Card className="overflow-hidden border-border/80 bg-card shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary shadow-xs">
                <SlidersHorizontal className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base sm:text-lg">Cotador Simplificado</CardTitle>
                  <Badge variant="outline" className="border-primary/30 bg-primary/5 text-[11px] font-semibold text-primary">
                    Site externo
                  </Badge>
                </div>
                <CardDescription className="mt-1">Simulações e cotações completas de planos de saúde.</CardDescription>
              </div>
            </div>
            <Button render={<a href={targetUrl} target="_blank" rel="noopener noreferrer" />} className="gap-1.5">
              Abrir cotador
              <ArrowSquareOut className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-[360px] flex-col items-center justify-center px-6 py-14 text-center sm:px-12">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-7" />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight">Abra o cotador em uma nova aba</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            O Cotador Simplificado não permite ser exibido dentro de outros sistemas. Abrir em uma nova aba mantém o acesso seguro e evita a tela de conexão recusada.
          </p>
          <Button render={<a href={targetUrl} target="_blank" rel="noopener noreferrer" />} className="mt-6 gap-1.5">
            Abrir Cotador Simplificado
            <ArrowSquareOut className="size-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="flex items-center gap-3.5">
          <span>O cotador abre diretamente no site oficial; seus dados de acesso não são armazenados pelo AncoraHub.</span>
        </div>
      </div>
    </div>
  );
}
