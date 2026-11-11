"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { BROKER_OFFER_MAX } from "@/features/leads/broker-ad-context";

import { saveCampaignBrokerOfferAction } from "../broker-brief-actions";

/** "Plano anunciado" no detalhe da campanha fora do visual Lite (10/11/2026). Mesmo dado e mesma ação do Lite. */
export function CampaignBrokerOfferCard({ campaignId, initialOffer, canEdit }: { campaignId: string; initialOffer: string | null; canEdit: boolean }) {
  const router = useRouter();
  const fieldId = useId();
  const [offer, setOffer] = useState(initialOffer ?? "");
  const [saved, setSaved] = useState(initialOffer ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const result = await saveCampaignBrokerOfferAction({ campaignId, offer });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setOffer(result.offer ?? "");
      setSaved(result.offer ?? "");
      toast.success(result.offer ? "Plano anunciado salvo. O corretor já vê no lead." : "Plano anunciado removido.");
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar o plano anunciado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-xl border-border/70 shadow-none">
      <CardHeader className="border-b border-border/50 pb-3.5">
        <CardTitle className="text-sm font-semibold">O que o corretor vê</CardTitle>
        <CardDescription className="text-xs">O corretor não vê o nome da campanha. Ele vê o anúncio e este texto, para não oferecer um plano mais caro do que o anunciado.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-4">
        <label htmlFor={fieldId} className="text-xs font-medium text-foreground">Plano anunciado</label>
        {canEdit ? (
          <>
            <Textarea
              id={fieldId}
              value={offer}
              maxLength={BROKER_OFFER_MAX}
              rows={2}
              placeholder="Ex.: Amil custo-benefício, individual, a partir de R$ 89"
              disabled={saving}
              onChange={(event) => setOffer(event.target.value)}
              className="rounded-md border-black"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">{offer.length}/{BROKER_OFFER_MAX}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void save()} disabled={saving || offer.trim() === saved.trim()}>
                {saving ? "Salvando..." : "Salvar plano anunciado"}
              </Button>
            </div>
          </>
        ) : (
          <p id={fieldId} className="text-sm text-muted-foreground">{saved || "Não informado"}</p>
        )}
      </CardContent>
    </Card>
  );
}
