import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { TipHost } from "@/components/chat/tip-host";

/** Dev-only print of the quick tip that pops up for the broker (18/10). The tip comes from /api/chat/tip (mock it to print). */
export default function TipPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="arc-venancor min-h-[100dvh] bg-(--surface-muted)">
      <TipHost />
    </div>
  );
}
