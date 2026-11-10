"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { BROKER_OFFER_MAX } from "@/features/leads/broker-ad-context";

import { saveCampaignBrokerOfferAction } from "../../broker-brief-actions";
import detail from "./campaign-detail-lite.module.css";

/**
 * "Plano anunciado" (10/11/2026): o que a campanha promete, escrito pela gestão e
 * mostrado ao corretor no cartão "De onde veio" do lead. O nome da campanha não vai.
 */
export function CampaignBrokerOfferLite({ campaignId, initialOffer, canEdit }: { campaignId: string; initialOffer: string | null; canEdit: boolean }) {
  const router = useRouter();
  const fieldId = useId();
  const hintId = useId();
  const [offer, setOffer] = useState(initialOffer ?? "");
  const [saved, setSaved] = useState(initialOffer ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = offer.trim() !== saved.trim();

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
    <section className={page.card} aria-labelledby={`${fieldId}-title`}>
      <div className={page.cardHead}>
        <h2 id={`${fieldId}-title`} className={page.cardTitle}>O que o corretor vê</h2>
        <p className={page.cardDescription}>O corretor não vê o nome da campanha. Ele vê o anúncio e este texto, para não oferecer um plano mais caro do que o anunciado.</p>
      </div>
      <div className={detail.offerField}>
        <label htmlFor={fieldId} className={page.cellTitle}>Plano anunciado</label>
        {canEdit ? (
          <>
            <textarea
              id={fieldId}
              className={detail.offerInput}
              value={offer}
              maxLength={BROKER_OFFER_MAX}
              rows={2}
              placeholder="Ex.: Amil custo-benefício, individual, a partir de R$ 89"
              aria-describedby={hintId}
              disabled={saving}
              onChange={(event) => setOffer(event.target.value)}
            />
            <div className={detail.offerFoot}>
              <span id={hintId} className={page.cellSub}>
                <span className={page.numeric}>{offer.length}/{BROKER_OFFER_MAX}</span> · Operadora, faixa de preço, tipo de plano e região.
              </span>
              <button type="button" className={page.button} onClick={() => void save()} disabled={saving || !dirty}>
                {saving ? "Salvando..." : "Salvar plano anunciado"}
              </button>
            </div>
          </>
        ) : (
          <p id={fieldId} className={page.cardDescription}>{saved || "Não informado"}</p>
        )}
      </div>
    </section>
  );
}
