import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <div className="space-y-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Acesso negado</h1>
        <p className="text-sm text-muted-foreground">Sua conta, associação ou tenant não está ativo para esta área.</p>
      </div>
      <Link className="text-sm underline" href="/login">Voltar ao login</Link>
    </div>
  );
}
