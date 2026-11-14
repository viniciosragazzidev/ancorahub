import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { FeedbackPreview } from "./preview";

/**
 * Vitrine do feedback padrão (docs/design-system/FEEDBACK.md), só em desenvolvimento:
 * botão de ação, mascote, aviso de lead novo, celebrações, sons e preferências. Dados falsos.
 */
export default function FeedbackDevPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <FeedbackPreview />;
}
