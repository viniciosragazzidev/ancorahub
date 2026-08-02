import { AncoraLogo } from "@/components/ancora-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card p-6 shadow-[0_16px_40px_rgb(15_23_42/0.10)] sm:p-8">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex items-center gap-2.5">
            <AncoraLogo className="h-10 w-36 object-contain" />
          </div>
          <p className="text-xs text-muted-foreground">Ambiente seguro de acesso</p>
        </div>
        {children}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          Âncora Corretora — Gestão para corretoras
        </div>
      </div>
    </main>
  );
}
