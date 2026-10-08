import { Skeleton } from "@/components/arc/skeleton/skeleton";

type Variant = "list" | "detail" | "dashboard";

const card = "rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)";

/**
 * Route-level loading state for the broker app (loading.tsx). White cards on the
 * #f7f7f9 canvas, same width as the screens so nothing jumps when content lands.
 * Arc Skeleton already respects prefers-reduced-motion.
 */
export function LightPageSkeleton({ variant = "list", label = "Carregando" }: { variant?: Variant; label?: string }) {
  return (
    <div
      className="arc-venancor mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-[calc(112px+var(--mobile-safe-bottom))] pt-2 sm:px-6 md:pb-8"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {variant === "dashboard" ? (
        <>
          <div className={card}><Skeleton lines={3} /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className={card}><Skeleton lines={2} /></div>
            ))}
          </div>
          <div className={card}><Skeleton lines={4} avatar /></div>
        </>
      ) : null}
      {variant === "list" ? (
        <>
          <div className="flex gap-2">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-10 w-24 rounded-full bg-(--surface) shadow-(--shadow-resting)" />
            ))}
          </div>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className={card}><Skeleton lines={3} avatar /></div>
          ))}
        </>
      ) : null}
      {variant === "detail" ? (
        <>
          <div className={card}><Skeleton lines={3} avatar /></div>
          <div className="h-14 rounded-full bg-(--surface) shadow-(--shadow-resting)" />
          <div className={card}><Skeleton lines={5} /></div>
        </>
      ) : null}
    </div>
  );
}
