import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { VendaCelebracaoPreview } from "./preview";

/** Prévia da celebração da venda registrada, só em desenvolvimento. Dados falsos. */
export default function VendaCelebracaoPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <VendaCelebracaoPreview />;
}
