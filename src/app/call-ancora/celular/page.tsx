import "@/components/arc/venancor-scope.css";

import { CallAncoraMobile } from "@/features/call-ancora/components/call-ancora-workspace";

export default async function CallAncoraMobilePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  if (!t || !/^[A-Za-z0-9_-]{40,80}$/.test(t)) {
    return <main className="arc-venancor grid min-h-dvh place-items-center bg-(--background) p-6"><section className="max-w-sm rounded-[2rem] border border-(--border) bg-(--surface) p-7 text-center"><h1 className="text-xl font-semibold text-(--foreground)">QR inválido</h1><p className="mt-2 text-sm leading-6 text-(--text-secondary)">Volte à tela do Call Âncora e gere um novo código de pareamento.</p></section></main>;
  }
  return <CallAncoraMobile token={t} />;
}
