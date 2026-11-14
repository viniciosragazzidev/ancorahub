"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "@/components/ui/sonner";

import { Plus, Trash } from "@/components/huge-icons";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
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
import { cn } from "@/lib/utils";
import embeddedStyles from "./beneficiaries-section.module.css";
import { lerCpf } from "@/shared/input/documento";
import { useCampoMascarado } from "@/shared/input/use-campo-mascarado";

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

function formatBirthDate(value: string | null): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

const relationshipLabels: Record<Relationship, string> = {
  conjuge: "Cônjuge",
  filho: "Filho(a)",
  outro: "Outro",
};

function dateFromKey(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : undefined;
}

function keyFromDate(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Só avisa quando os 11 números já foram digitados e não formam um CPF válido (o servidor recusaria). */
function avisoCpf(valor: string): string | null {
  if (valor.replace(/\D/g, "").length < 11) return null;
  const lido = lerCpf(valor);
  return lido.ok ? null : lido.mensagem;
}

export function BeneficiariesSection({
  leadId,
  contactName,
  initialBeneficiaries,
  onChanged,
  embedded = false,
}: {
  leadId: string;
  contactName: string;
  initialBeneficiaries: Beneficiary[];
  onChanged?: () => void;
  embedded?: boolean;
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
  // O formulário de inclusão abre num painel próprio; a área principal mostra só as pessoas já cadastradas.
  const [addOpen, setAddOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  // CPF com máscara (colar "529 982 247 25" funciona) e aviso na hora quando os 11 números não fecham.
  const cpfCampo = useCampoMascarado("cpf", cpf, setCpf);
  const editCpfCampo = useCampoMascarado("cpf", editCpf, setEditCpf);
  const cpfAviso = avisoCpf(cpf);
  const editCpfAviso = avisoCpf(editCpf);

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
      setAddOpen(false);
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
    <Card className={embedded ? "rounded-none border-0 bg-transparent p-0 shadow-none" : "border-border bg-card shadow-none"}>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">Pessoas da contratação</CardTitle>
        {embedded ? null : (
          <CardDescription>
            O contato do lead é o titular. Adicione os dependentes que farão parte da contratação.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="grid gap-2" aria-label="Pessoas da contratação">
          {isCompletingHolder ? (
            <li className={cn("flex items-start justify-between gap-3 rounded-[var(--radius-card)] border border-dashed border-border bg-muted/30 p-3 text-sm", embedded && embeddedStyles.person)}>
              <div className="min-w-0">
                <p className="truncate font-medium">{contactName}</p>
                <p className="mt-1 text-xs text-muted-foreground">Contato do lead · confirme a data de nascimento</p>
              </div>
              <Badge>Titular</Badge>
            </li>
          ) : null}
          {beneficiaries.map((beneficiary) => (
            <li className={cn("rounded-[var(--radius-card)] border border-border bg-card p-3 text-sm", embedded && embeddedStyles.person)} key={beneficiary.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="break-words font-medium">{beneficiary.name}</p>
                    {beneficiary.isHolder ? <Badge>Titular</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[formatBirthDate(beneficiary.birthDate), beneficiary.age != null ? `${beneficiary.age} anos` : null, beneficiary.isHolder ? "Titular da contratação" : relationshipLabels[beneficiary.relationship as Relationship] ?? beneficiary.relationship, beneficiary.hasCpf ? "CPF cadastrado" : null].filter(Boolean).join(" · ") || "Dados pessoais pendentes"}
                  </p>
                </div>
                <div className="-my-1 -mr-1 flex shrink-0 items-center">
                  <Button type="button" size="sm" variant="ghost" className="min-h-11" disabled={pending} onClick={() => edit(beneficiary)}>Editar</Button>
                  {!beneficiary.isHolder ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-11 text-destructive hover:text-destructive"
                      disabled={pending}
                      aria-label={`Excluir ${beneficiary.name}`}
                      onClick={() => setBeneficiaryToDelete(beneficiary)}
                    >
                      <Trash className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Button ref={addButtonRef} type="button" variant="outline" className={cn("min-h-11 w-full gap-2", embedded && embeddedStyles.add)} disabled={pending} onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          {isCompletingHolder ? "Confirmar titular" : "Adicionar dependente"}
        </Button>
      </CardContent>

      <BottomSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        returnFocusRef={addButtonRef}
        title={isCompletingHolder ? "Completar dados do titular" : "Adicionar dependente"}
        description={isCompletingHolder ? "Use o contato já registrado no lead como titular da contratação." : "Inclua apenas as pessoas que farão parte da contratação."}
        detents={[0.86]}
        closeLabel="Fechar"
        className="arc-venancor"
      >
        <div className="grid grid-cols-1 gap-3 pb-4">
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
            <DatePicker id="beneficiary-birth" label="Data de nascimento" className="min-h-11" value={dateFromKey(birthDate)} onChange={(date) => setBirthDate(keyFromDate(date))} locale="pt-BR" format={{ day: "2-digit", month: "2-digit", year: "numeric" }} placeholder="Selecione uma data" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="beneficiary-age">Idade, se não souber a data</Label>
            <Input id="beneficiary-age" className="min-h-11" inputMode="numeric" type="number" min={0} max={120} value={age} onChange={(event) => setAge(event.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="beneficiary-cpf">CPF, se informado</Label>
            <Input id="beneficiary-cpf" format="none" className="min-h-11" {...cpfCampo} aria-invalid={cpfAviso ? true : undefined} aria-describedby={cpfAviso ? "beneficiary-cpf-aviso" : undefined} placeholder="000.000.000-00" />
            {cpfAviso ? <p id="beneficiary-cpf-aviso" className="text-xs text-destructive">{cpfAviso}</p> : null}
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

          <Button type="button" className="mt-1 min-h-11 w-full" disabled={pending || !draftName || (!birthDate && !age)} onClick={add}>
            {pending ? "Salvando..." : isCompletingHolder ? "Confirmar titular" : "Adicionar dependente"}
          </Button>
        </div>
      </BottomSheet>

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
              <div className="space-y-1.5"><DatePicker id="edit-beneficiary-birth" label="Data de nascimento" className="min-h-11" value={dateFromKey(editBirthDate)} onChange={(date) => setEditBirthDate(keyFromDate(date))} locale="pt-BR" format={{ day: "2-digit", month: "2-digit", year: "numeric" }} placeholder="Selecione uma data" /></div>
              <div className="space-y-1.5"><Label htmlFor="edit-beneficiary-age">Idade, se não souber a data</Label><Input id="edit-beneficiary-age" className="min-h-11" inputMode="numeric" type="number" min={0} max={120} value={editAge} onChange={(event) => setEditAge(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="edit-beneficiary-cpf">CPF, se informado</Label><Input id="edit-beneficiary-cpf" format="none" className="min-h-11" {...editCpfCampo} aria-invalid={editCpfAviso ? true : undefined} aria-describedby={editCpfAviso ? "edit-beneficiary-cpf-aviso" : undefined} placeholder={beneficiaryToEdit?.hasCpf ? "Já cadastrado. Deixe em branco para manter." : "000.000.000-00"} />{editCpfAviso ? <p id="edit-beneficiary-cpf-aviso" className="text-xs text-destructive">{editCpfAviso}</p> : null}</div>
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
