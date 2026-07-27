import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AccountTab({ name, email, role }: { name: string; email: string; role: string }) {
  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle>Minha conta</CardTitle>
        <CardDescription>Seus dados de acesso e o papel que define suas permissões no CorreTop.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Nome</p><p className="mt-1 text-sm font-medium">{name}</p></div>
        <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">E-mail</p><p className="mt-1 text-sm font-medium break-all">{email}</p></div>
        <div className="rounded-lg border border-border p-4 sm:col-span-2"><p className="text-xs text-muted-foreground">Perfil de acesso</p><p className="mt-1 text-sm font-medium">{role}</p><p className="mt-1 text-xs text-muted-foreground">O perfil é administrado pela corretora e não pode ser alterado nesta tela.</p></div>
      </CardContent>
    </Card>
  );
}
