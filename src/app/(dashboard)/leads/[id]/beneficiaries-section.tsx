"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/sonner";

import { Trash } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addLeadBeneficiaryAction, removeLeadBeneficiaryAction, updateLeadBeneficiaryAction } from "@/features/post-sale/actions";

type Beneficiary = {
  id: string;
  name: string;
  birthDate: string | null;
  age?: number | null;
  cpf?: string | null;
  hasCpf?: boolean;
  relationship: string;
  isHolder: boolean;
};

type Relationship = "conjuge" | "filho" | "outro";

const relationshipLabels: Record<Relationship, string> = {
  conjuge: "Cônjuge",
  filho: "Filho(a)",
  outro: "Outro",
};

export function BeneficiariesSection({
  leadId,
  contactName,
  initialBeneficiaries,
  onChanged,
}: {
  leadId: string;
  contactName: string;
  initialBeneficiaries: Beneficiary[];
  onChanged?: () => void;
}) {
  const [beneficiaries, setBeneficiaries] = useState(initialBeneficiaries);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [age, setAge] = useState("");
  const [cpf, setCpf] = useState("");
  const [relationship, setRelationship] = useState<Relationship>("filho");
  const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<Beneficiary | null>(null);
  const [beneficiaryToEdit, setBeneficiaryToEdit] = useState<Beneficiary | null>(null);
  const [editName, setEditName] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editRelationship, setEditRelationship] = useState<Relationship>("filho");

  const holder = beneficiaries.find((beneficiary) => beneficiary.isHolder);
  const isCompletingHolder = !holder;
  const draftName = isCompletingHolder ? contactName : name.trim();

  function add() {
    startTransition(async () => {
      const result = await addLeadBeneficiaryAction({
        leadId,
        name: draftName,
        birthDate: birthDate || null,
        age: age ? Number(age) : null,
        cpf: cpf || null,
        relationship,
        isHolder: isCompletingHolder,
      });

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (!("id" in result)) return;

      setBeneficiaries((current) => [
        ...current,
        {
          id: result.id!,
          name: draftName,
          birthDate: birthDate || null,
          age: age ? Number(age) : null,
          cpf: null,
          hasCpf: Boolean(cpf),
          relationship: isCompletingHolder ? "titular" : relationship,
          isHolder: isCompletingHolder,
        },
      ]);
      setName("");
      setBirthDate("");
      setAge("");
      setCpf("");
      setRelationship("filho");
      onChanged?.();
      toast.success(isCompletingHolder ? "Titular confirmado." : "Beneficiário adicionado.");
    });
  }

  function edit(beneficiary: Beneficiary) {
    setBeneficiaryToEdit(beneficiary);
    setEditName(beneficiary.name);
    setEditBirthDate(beneficiary.birthDate ?? "");
    setEditAge(beneficiary.age == null ? "" : String(beneficiary.age));
    setEditCpf("");
    setEditRelationship((beneficiary.relationship === "conjuge" || beneficiary.relationship === "filho" ? beneficiary.relationship : "outro") as Relationship);
  }

  function saveEdit() {
    if (!beneficiaryToEdit) return;
    startTransition(async () => {
      const result = await updateLeadBeneficiaryAction({
        beneficiaryId: beneficiaryToEdit.id,
        leadId,
        name: editName,
        birthDate: editBirthDate || null,
        age: editAge ? Number(editAge) : null,
        cpf: editCpf || null,
        relationship: beneficiaryToEdit.isHolder ? "titular" : editRelationship,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setBeneficiaries((current) => current.map((item) => item.id === beneficiaryToEdit.id ? {
        ...item,
        name: editName.trim(),
        birthDate: editBirthDate || null,
        age: editAge ? Number(editAge) : null,
        cpf: null,
        hasCpf: item.hasCpf || Boolean(editCpf),
        relationship: item.isHolder ? "titular" : editRelationship,
      } : item));
      setBeneficiaryToEdit(null);
      onChanged?.();
      toast.success("Dados da pessoa atualizados.");
    });
  }

  function remove() {
    if (!beneficiaryToDelete) return;

    startTransition(async () => {
      const result = await removeLeadBeneficiaryAction(beneficiaryToDelete.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      setBeneficiaries((current) => current.filter((beneficiary) => beneficiary.id !== beneficiaryToDelete.id));
      setBeneficiaryToDelete(null);
      onChanged?.();
      toast.success("Beneficiário excluído.");
    });
  }

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="gap-1">
        <CardTitle className="text-base">Pessoas da contratação</CardTitle>
        <CardDescription>
          O contato do lead inicia como titular. Confirme sua data de nascimento e adicione dependentes quando necessário.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-64 overflow-y-auto rounded-[var(--radius-card)] border border-border">
          {isCompletingHolder ? (
            <div className="flex items-start justify-between gap-3 bg-muted/30 px-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{contactName}</p>
                <p className="mt-1 text-xs text-muted-foreground">Contato do lead</p>
              </div>
              <Badge>Titular</Badge>
            </div>
          ) : null}

          {beneficiaries.length ? (
            <div className="divide-y divide-border">
              {beneficiaries.map((beneficiary) => (
                <div className="flex items-start justify-between gap-3 px-3 py-3 text-sm" key={beneficiary.id}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="break-words font-medium">{beneficiary.name}</p>
                      {beneficiary.isHolder ? <Badge>Titular</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[beneficiary.birthDate, beneficiary.age != null ? `${beneficiary.age} anos` : null, beneficiary.isHolder ? "Titular da contratação" : beneficiary.relationship, beneficiary.hasCpf ? "CPF cadastrado" : null].filter(Boolean).join(" · ") || "Dados pessoais pendentes"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" size="sm" variant="ghost" className="min-h-11" disabled={pending} onClick={() => edit(beneficiary)}>Editar</Button>
                    {!beneficiary.isHolder ? <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-11 shrink-0 text-destructive hover:text-destructive"
                      disabled={pending}
                      onClick={() => setBeneficiaryToDelete(beneficiary)}
                    >
                      <Trash className="size-4" />
                      Excluir
                    </Button> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-3 rounded-[var(--radius-card)] border border-dashed border-border p-3">
          <div>
            <p className="text-sm font-medium">{isCompletingHolder ? "Completar dados do titular" : "Adicionar dependente"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isCompletingHolder
                ? "Use o contato já registrado no lead como titular da contratação."
                : "Inclua apenas as pessoas que farão parte da contratação."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {isCompletingHolder ? (
              <div className="space-y-1.5">
                <Label htmlFor="beneficiary-holder-name">Titular</Label>
                <Input id="beneficiary-holder-name" className="min-h-11" value={contactName} readOnly aria-readonly="true" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="beneficiary-name">Nome do dependente</Label>
                <Input id="beneficiary-name" className="min-h-11" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="beneficiary-birth">Data de nascimento</Label>
              <Input id="beneficiary-birth" className="min-h-11" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="beneficiary-age">Idade, se não souber a data</Label>
              <Input id="beneficiary-age" className="min-h-11" inputMode="numeric" type="number" min={0} max={120} value={age} onChange={(event) => setAge(event.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="beneficiary-cpf">CPF, se informado</Label>
              <Input id="beneficiary-cpf" className="min-h-11" inputMode="numeric" value={cpf} onChange={(event) => setCpf(event.target.value)} placeholder="000.000.000-00" />
            </div>

            {!isCompletingHolder ? (
              <div className="space-y-1.5">
                <Label htmlFor="beneficiary-relationship">Parentesco</Label>
                <Select
                  value={relationship}
                  labels={relationshipLabels}
                  onValueChange={(value) => setRelationship((value ?? "filho") as Relationship)}
                >
                  <SelectTrigger id="beneficiary-relationship" className="min-h-11 w-full">
                    <SelectValue placeholder="Selecione o parentesco" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(relationshipLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <Button type="button" className="min-h-11 w-full" disabled={pending || !draftName || (!birthDate && !age)} onClick={add}>
            {isCompletingHolder ? "Confirmar titular" : "Adicionar beneficiário"}
          </Button>
        </div>
      </CardContent>

      <Dialog open={Boolean(beneficiaryToDelete)} onOpenChange={(open) => !open && setBeneficiaryToDelete(null)}>
        <DialogPopup>
          <DialogPanel>
            <DialogHeader>
              <DialogTitle>Excluir beneficiário?</DialogTitle>
              <DialogDescription>
                {beneficiaryToDelete
                  ? `${beneficiaryToDelete.name} será removido da contratação. Documentos e cotações já vinculados impedem a exclusão para preservar o histórico.`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => setBeneficiaryToDelete(null)}>Cancelar</Button>
              <Button type="button" variant="destructive" className="min-h-11" disabled={pending} onClick={remove}>Excluir beneficiário</Button>
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>

      <Dialog open={Boolean(beneficiaryToEdit)} onOpenChange={(open) => !open && setBeneficiaryToEdit(null)}>
        <DialogPopup>
          <DialogPanel className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar pessoa da contratação</DialogTitle>
              <DialogDescription>Revise os dados usados no registro da venda.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <div className="space-y-1.5"><Label htmlFor="edit-beneficiary-name">Nome</Label><Input id="edit-beneficiary-name" className="min-h-11" value={editName} onChange={(event) => setEditName(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="edit-beneficiary-birth">Data de nascimento</Label><Input id="edit-beneficiary-birth" className="min-h-11" type="date" value={editBirthDate} onChange={(event) => setEditBirthDate(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="edit-beneficiary-age">Idade, se não souber a data</Label><Input id="edit-beneficiary-age" className="min-h-11" type="number" min={0} max={120} value={editAge} onChange={(event) => setEditAge(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="edit-beneficiary-cpf">CPF, se informado</Label><Input id="edit-beneficiary-cpf" className="min-h-11" inputMode="numeric" value={editCpf} onChange={(event) => setEditCpf(event.target.value)} placeholder={beneficiaryToEdit?.hasCpf ? "Já cadastrado. Deixe em branco para manter." : "000.000.000-00"} /></div>
              {!beneficiaryToEdit?.isHolder ? <div className="space-y-1.5"><Label htmlFor="edit-beneficiary-relationship">Parentesco</Label><Select value={editRelationship} labels={relationshipLabels} onValueChange={(value) => setEditRelationship((value ?? "filho") as Relationship)}><SelectTrigger id="edit-beneficiary-relationship" className="min-h-11 w-full"><SelectValue placeholder="Selecione o parentesco" /></SelectTrigger><SelectContent>{Object.entries(relationshipLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div> : null}
              {beneficiaryToEdit?.hasCpf ? <p className="text-xs text-muted-foreground">O CPF existente fica protegido. Deixe o campo em branco para mantê-lo.</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => setBeneficiaryToEdit(null)}>Cancelar</Button>
              <Button type="button" className="min-h-11" disabled={pending || (!editBirthDate && !editAge)} onClick={saveEdit}>Salvar dados</Button>
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </Card>
  );
}
