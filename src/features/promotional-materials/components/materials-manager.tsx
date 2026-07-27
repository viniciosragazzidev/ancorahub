"use client";

import { useState } from "react";
import { useActionState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, EyeSlash, PencilSimple, Plus, Trash, X } from "@/components/huge-icons";
import {
  createPromotionalMaterial,
  updatePromotionalMaterial,
  togglePromotionalMaterialActive,
  deletePromotionalMaterial,
} from "../actions";
import type { PromotionalMaterialActionState, PromotionalMaterialCategory } from "../types";

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
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date | null;
  createdBy: string;
  createdByName: string | null;
};

const CATEGORY_LABELS: Record<PromotionalMaterialCategory, string> = {
  todos: "Todos",
  avisos: "Avisos",
  eventos: "Eventos",
  informativos: "Informativos",
  premiacoes: "Premiações",
  promocoes: "Promoções",
  treinamentos: "Treinamentos",
  materiais_divulgacao: "Materiais de Divulgação",
};

const CATEGORY_BADGE_VARIANT: Record<PromotionalMaterialCategory, "default" | "secondary" | "info" | "success" | "warning" | "purple" | "orange" | "cyan"> = {
  todos: "default",
  avisos: "warning",
  eventos: "info",
  informativos: "secondary",
  premiacoes: "purple",
  promocoes: "success",
  treinamentos: "orange",
  materiais_divulgacao: "cyan",
};

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

type FormDataState = {
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  fileUrl: string;
  targetBranch: string;
  targetCarrier: string;
  targetState: string;
  active: string;
  sortOrder: string;
};

const emptyForm: FormDataState = {
  title: "",
  description: "",
  category: "materiais_divulgacao",
  imageUrl: "",
  fileUrl: "",
  targetBranch: "",
  targetCarrier: "",
  targetState: "",
  active: "true",
  sortOrder: "0",
};

export function MaterialsManager({ materials }: { materials: Material[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormDataState>(emptyForm);

  const [createState, createFormAction, createPending] =
    useActionState<PromotionalMaterialActionState, FormData>(
      createPromotionalMaterial,
      {},
    );
  const [updateState, updateFormAction, updatePending] =
    useActionState<PromotionalMaterialActionState, FormData>(
      (prev, fd) => updatePromotionalMaterial(editingId!, prev, fd),
      {},
    );

  function handleEdit(material: Material) {
    setEditingId(material.id);
    setFormData({
      title: material.title,
      description: material.description ?? "",
      category: material.category,
      imageUrl: material.imageUrl ?? "",
      fileUrl: material.fileUrl ?? "",
      targetBranch: material.targetBranch ?? "",
      targetCarrier: material.targetCarrier ?? "",
      targetState: material.targetState ?? "",
      active: material.active ? "true" : "false",
      sortOrder: String(material.sortOrder),
    });
    setShowForm(true);
  }

  function handleNew() {
    setEditingId(null);
    setFormData(emptyForm);
    setShowForm(true);
  }

  function handleCancel() {
    setEditingId(null);
    setShowForm(false);
    setFormData(emptyForm);
  }

  async function handleToggle(id: string, currentActive: boolean) {
    const result = await togglePromotionalMaterialActive(id, !currentActive);
    if (result.error) toast.error(result.error);
    else toast.success(currentActive ? "Material desativado." : "Material ativado.");
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este material?")) return;
    const result = await deletePromotionalMaterial(id);
    if (result.error) toast.error(result.error);
    else toast.success("Material excluído.");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {materials.length} material(is) cadastrado(s)
        </p>
        <Button onClick={handleNew} size="sm">
          <Plus className="size-4" />
          Novo material
        </Button>
      </div>

      {showForm && (
        <Card className="border-border bg-card shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>{editingId ? "Editar material" : "Novo material"}</CardTitle>
              <CardDescription>
                {editingId
                  ? "Atualize as informações do material."
                  : "Preencha os dados para criar um novo material de divulgação."}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleCancel}>
              <X className="size-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form
              action={editingId ? updateFormAction : createFormAction}
              className="grid gap-4 sm:grid-cols-2"
            >
              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <span>Título *</span>
                <Input
                  name="title"
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  required
                  placeholder="Ex.: Tabela de preços julho/2026"
                />
              </label>

              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <span>Descrição</span>
                <Input
                  name="description"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Breve descrição do material..."
                />
              </label>

              <label className="grid gap-1.5 text-sm">
                <span>Categoria *</span>
                <select
                  className={selectClassName}
                  name="category"
                  value={formData.category}
                  onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                  required
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm">
                <span>Status</span>
                <select
                  className={selectClassName}
                  name="active"
                  value={formData.active}
                  onChange={(e) => setFormData((p) => ({ ...p, active: e.target.value }))}
                >
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </label>

              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <span>URL da imagem</span>
                <Input
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData((p) => ({ ...p, imageUrl: e.target.value }))}
                  placeholder="https://exemplo.com/imagem.jpg"
                  type="url"
                />
              </label>

              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <span>URL do arquivo para download</span>
                <Input
                  name="fileUrl"
                  value={formData.fileUrl}
                  onChange={(e) => setFormData((p) => ({ ...p, fileUrl: e.target.value }))}
                  placeholder="https://exemplo.com/arquivo.pdf"
                  type="url"
                />
              </label>

              <label className="grid gap-1.5 text-sm">
                <span>Filial alvo</span>
                <Input
                  name="targetBranch"
                  value={formData.targetBranch}
                  onChange={(e) => setFormData((p) => ({ ...p, targetBranch: e.target.value }))}
                  placeholder="Opcional"
                />
              </label>

              <label className="grid gap-1.5 text-sm">
                <span>Operadora alvo</span>
                <Input
                  name="targetCarrier"
                  value={formData.targetCarrier}
                  onChange={(e) => setFormData((p) => ({ ...p, targetCarrier: e.target.value }))}
                  placeholder="Opcional"
                />
              </label>

              <label className="grid gap-1.5 text-sm">
                <span>Estado alvo (UF)</span>
                <Input
                  name="targetState"
                  value={formData.targetState}
                  onChange={(e) => setFormData((p) => ({ ...p, targetState: e.target.value }))}
                  placeholder="Opcional"
                  maxLength={2}
                />
              </label>

              <label className="grid gap-1.5 text-sm">
                <span>Ordem</span>
                <Input
                  name="sortOrder"
                  type="number"
                  min={0}
                  value={formData.sortOrder}
                  onChange={(e) => setFormData((p) => ({ ...p, sortOrder: e.target.value }))}
                />
              </label>

              <div className="flex items-end gap-2 sm:col-span-2">
                <Button disabled={createPending || updatePending} type="submit">
                  {createPending || updatePending
                    ? "Salvando..."
                    : editingId
                      ? "Atualizar"
                      : "Criar material"}
                </Button>
                <Button variant="outline" type="button" onClick={handleCancel}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-card shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Título</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead className="pr-5 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material) => (
                <TableRow key={material.id}>
                  <TableCell className="pl-5 font-medium max-w-[240px] truncate">
                    {material.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant={CATEGORY_BADGE_VARIANT[material.category]}>
                      {CATEGORY_LABELS[material.category]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={material.active ? "success" : "secondary"}>
                      {material.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {material.createdByName ?? "—"}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleToggle(material.id, material.active)}
                        title={material.active ? "Desativar" : "Ativar"}
                      >
                        {material.active ? (
                          <EyeSlash className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleEdit(material)}
                        title="Editar"
                      >
                        <PencilSimple className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(material.id)}
                        title="Excluir"
                      >
                        <Trash className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {materials.length === 0 && (
                <TableRow>
                  <TableCell className="p-6 text-center text-sm text-muted-foreground" colSpan={5}>
                    Nenhum material de divulgação cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
