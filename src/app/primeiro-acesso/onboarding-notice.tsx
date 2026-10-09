import "@/components/arc/venancor-scope.css";

/** Full-screen notice of the first-access flow (missing, used, expired or unknown invitation). */
export function OnboardingNotice({ title, description }: { title: string; description: string }) {
  return (
    <div className="arc-venancor light-canvas flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10" style={{ color: "var(--foreground)" }}>
      <main className="w-full max-w-md rounded-3xl bg-(--surface) p-6 text-center shadow-(--shadow-resting)">
        <h1 className="text-xl font-bold tracking-tight text-(--foreground)">{title}</h1>
        <p className="mt-2 text-sm text-(--text-secondary)">{description}</p>
      </main>
    </div>
  );
}
