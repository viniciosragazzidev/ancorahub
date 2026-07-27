import { CorreTopLogo } from "@/components/corretop-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-zinc-50 p-4 sm:p-6 dark:bg-zinc-950">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex items-center gap-2.5">
            <CorreTopLogo className="h-10 w-36 object-contain" />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Ambiente seguro de acesso</p>
        </div>
        {children}
        <div className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
          Gestão para corretoras
        </div>
      </div>
    </main>
  );
}
