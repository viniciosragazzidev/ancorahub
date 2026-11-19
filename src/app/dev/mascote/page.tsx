import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { MascotePreview } from "./preview";

/** Prévia do mascote e da splash (MASCOTE.md), só em desenvolvimento. Dados falsos. */
export default function MascotePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MascotePreview />;
}
