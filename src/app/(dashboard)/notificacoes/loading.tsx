import { Skeleton } from "@/components/ui/skeleton";

/** Notificações serve every role, Lite and full: neutral blocks that take the colors of the shell around them. */
export default function Loading() {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-3 p-4" aria-label="Carregando notificações" aria-busy="true">
      <Skeleton className="h-7 w-44 rounded-full" />
      {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-16 rounded-2xl" />)}
    </main>
  );
}
