import { Badge } from "@/components/ui/badge";

export function CatalogStatusBadge({ status }: { status: "draft" | "published" | "archived" | boolean }) {
  const active = status === true || status === "published";
  const label = typeof status === "boolean" ? (status ? "Ativo" : "Arquivado") : status === "published" ? "Publicado" : status === "draft" ? "Rascunho" : "Arquivado";
  return <Badge variant={active ? "success" : "outline"}>{label}</Badge>;
}
