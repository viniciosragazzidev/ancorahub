"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { addLeadBeneficiaryAction, removeLeadBeneficiaryAction } from "@/features/post-sale/actions";

type Beneficiary = {
  id: string;
  name: string;
  birthDate: string;
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
}: {
  leadId: string;
  contactName: string;
  initialBeneficiaries: Beneficiary[];
}) {
  const [beneficiaries, setBeneficiaries] = useState(initialBeneficiaries);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [relationship, setRelationship] = useState<Relationship>("filho");
  const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<Beneficiary | null>(null);

  const holder = beneficiaries.find((beneficiary) => beneficiary.isHolder);
  const isCompletingHolder = !holder;
  const draftName = isCompletingHolder ? contactName : name.trim();

  function add() {
    startTransition(async () => {
      const result = await addLeadBeneficiaryAction({
        leadId,
        name: draftName,
        birthDate,
        relationship,
        isHolder: isCompletingHolder,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setBeneficiaries((current) => [
        ...current,
        {
          id: result.id!,
          name: draftName,
          birthDate,
          relationship: isCompletingHolder ? "titular" : relationship,
          isHolder: isCompletingHolder,
        },
      ]);
      setName("");
      setBirthDate("");
      setRelationship("filho");
      toast.success(isCompletingHolder ? "Titular confirmado." : "Beneficiário adicionado.");
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
        <div className="overflow-hidden rounded-lg border border-border">
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
                      {beneficiary.birthDate} · {beneficiary.isHolder ? "Titular da contratação" : beneficiary.relationship}
                    </p>
                  </div>
                  {!beneficiary.isHolder ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-destructive hover:text-destructive"
                      disabled={pending}
                      onClick={() => setBeneficiaryToDelete(beneficiary)}
                    >
                      <Trash className="size-4" />
                      Excluir
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
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
                <Input id="beneficiary-holder-name" value={contactName} readOnly aria-readonly="true" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="beneficiary-name">Nome do dependente</Label>
                <Input id="beneficiary-name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="beneficiary-birth">Data de nascimento</Label>
              <Input id="beneficiary-birth" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
            </div>

            {!isCompletingHolder ? (
              <div className="space-y-1.5">
                <Label htmlFor="beneficiary-relationship">Parentesco</Label>
                <Select
                  value={relationship}
                  labels={relationshipLabels}
                  onValueChange={(value) => setRelationship((value ?? "filho") as Relationship)}
                >
                  <SelectTrigger id="beneficiary-relationship" className="w-full">
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

          <Button type="button" className="w-full" disabled={pending || !draftName || !birthDate} onClick={add}>
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
              <Button type="button" variant="outline" disabled={pending} onClick={() => setBeneficiaryToDelete(null)}>Cancelar</Button>
              <Button type="button" variant="destructive" disabled={pending} onClick={remove}>Excluir beneficiário</Button>
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </Card>
  );
}
