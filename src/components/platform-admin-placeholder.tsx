import { CircleDashed } from "@/components/huge-icons";
import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PlatformAdminPlaceholder({ title, description }: { title: string; description: string }) {
  return <><PlatformAdminHeader breadcrumb="Plataforma" title={title} /><main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6"><section><p className="text-xs font-medium text-primary">SUPER ADMIN</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p></section><Card className="border-border bg-card shadow-none"><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Módulo preparado</CardTitle><CardDescription>Esta área está criada e pronta para receber as operações da plataforma.</CardDescription></div><Badge variant="outline" className="gap-1.5"><CircleDashed size={13} /> Planejado</Badge></div></CardHeader><CardContent><p className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">A implementação funcional deste módulo será conectada ao domínio de super-admin.</p></CardContent></Card></main></>;
}
