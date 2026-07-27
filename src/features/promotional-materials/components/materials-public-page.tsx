"use client";

import { useState } from "react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, FileArrowDown, FileText } from "@/components/huge-icons";
import type { PromotionalMaterialCategory } from "../types";

type Material = {
  id: string;
  title: string;
  description: string | null;
  category: PromotionalMaterialCategory;
  imageUrl: string | null;
  fileUrl: string | null;
  targetBranch: string | null;
  targetCarrier: string | null;
  targetState: string | null;
};

const CATEGORY_OPTIONS: { value: PromotionalMaterialCategory; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "avisos", label: "Avisos" },
  { value: "eventos", label: "Eventos" },
  { value: "informativos", label: "Informativos" },
  { value: "premiacoes", label: "Premiações" },
  { value: "promocoes", label: "Promoções" },
  { value: "treinamentos", label: "Treinamentos" },
  { value: "materiais_divulgacao", label: "Materiais de Divulgação" },
];

type SubFilter = "todos" | "ramo" | "fornecedor" | "estado";

export function MaterialsPublicPage({ materials }: { materials: Material[] }) {
  const [activeCategory, setActiveCategory] = useState<PromotionalMaterialCategory>("todos");
  const [activeSubFilter, setActiveSubFilter] = useState<SubFilter>("todos");

  const filtered = materials.filter((m) => {
    if (activeCategory !== "todos" && m.category !== activeCategory) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-xs font-medium text-primary">MARKETING</p>
        <h1 className="text-2xl font-semibold tracking-tight">Materiais de Divulgação</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Acesse materiais exclusivos para impulsionar suas vendas. Baixe, imprima ou compartilhe com seus clientes.
        </p>
      </section>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_OPTIONS.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              activeCategory === cat.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Sub-filter chips */}
      <div className="flex flex-wrap gap-2">
        {([
          { value: "todos" as SubFilter, label: "Todos" },
          { value: "ramo" as SubFilter, label: "Ramo" },
          { value: "fornecedor" as SubFilter, label: "Fornecedor" },
          { value: "estado" as SubFilter, label: "Estado" },
        ]).map((sf) => (
          <button
            key={sf.value}
            onClick={() => setActiveSubFilter(sf.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              activeSubFilter === sf.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {sf.label}
          </button>
        ))}
      </div>

      {/* Materials grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((material) => (
          <Card key={material.id} className="overflow-hidden border-border bg-card shadow-none">
            <CardContent className="p-0">
              {/* Action buttons */}
              <div className="flex items-center justify-center gap-2 border-b border-border p-3">
                {material.fileUrl && (
                  <Button variant="outline" size="icon" className="size-9" render={<a href={material.fileUrl} target="_blank" rel="noopener noreferrer" />} title="Baixar">
                    <FileArrowDown className="size-4" />
                  </Button>
                )}
                <Button variant="outline" size="icon" className="size-9" title="Imprimir" onClick={() => window.print()}>
                  <FileText className="size-4" />
                </Button>
                {material.imageUrl && (
                  <Button variant="outline" size="icon" className="size-9" render={<a href={material.imageUrl} target="_blank" rel="noopener noreferrer" />} title="Visualizar">
                    <Eye className="size-4" />
                  </Button>
                )}
              </div>

              {/* Image */}
              {material.imageUrl && (
                <div className="relative aspect-[4/3] w-full bg-muted">
                  <Image
                    src={material.imageUrl}
                    alt={material.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {material.category.replace(/_/g, " ")}
                  </Badge>
                  {material.targetState && (
                    <Badge variant="outline">{material.targetState}</Badge>
                  )}
                </div>
                <h3 className="text-sm font-semibold leading-tight">{material.title}</h3>
                {material.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{material.description}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhum material encontrado para esta categoria.</p>
        </div>
      )}
    </div>
  );
}
