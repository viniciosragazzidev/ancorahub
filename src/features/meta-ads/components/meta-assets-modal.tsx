"use client";

import { useState } from "react";
import { CheckCircle, Globe, Phone, SquaresFour, UserList } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import type { MetaDiscoveredAssets } from "../types";

export function MetaAssetsModal({
  open,
  onOpenChange,
  assets,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: MetaDiscoveredAssets | null;
  onConfirm: (payload: {
    businessId: string;
    businessName: string;
    pages: Array<{ id: string; name: string }>;
    adAccounts: Array<{ id: string; name: string; currency: string }>;
    whatsapp?: { wabaId: string; phoneNumberId: string; displayPhoneNumber: string } | null;
  }) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  if (!assets) return null;

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await onConfirm({
        businessId: assets.business.id,
        businessName: assets.business.name,
        pages: assets.pages.map((p) => ({ id: p.id, name: p.name })),
        adAccounts: assets.adAccounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency })),
        whatsapp: assets.whatsapp
          ? {
              wabaId: assets.whatsapp.wabaId || "",
              phoneNumberId: assets.whatsapp.phoneNumberId || "",
              displayPhoneNumber: assets.whatsapp.displayPhoneNumber || "",
            }
          : null,
      });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-mono text-[10px] uppercase">
              Embedded Signup v4
            </Badge>
          </div>
          <DialogTitle className="text-lg font-bold">Ativos Meta Descobertos</DialogTitle>
          <DialogDescription className="text-xs">
            Confirmar a vinculação automática dos seguintes ativos ao seu tenant CorreTop:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Empresa */}
          <Card className="border-border/60 bg-card shadow-none">
            <CardHeader className="p-3 pb-1">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-primary" />
                <CardTitle className="text-xs font-semibold">Empresa / Business Manager</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <p className="text-sm font-bold text-foreground">{assets.business.name}</p>
              <p className="text-[11px] font-mono text-muted-foreground">ID: {assets.business.id}</p>
            </CardContent>
          </Card>

          {/* Páginas */}
          <Card className="border-border/60 bg-card shadow-none">
            <CardHeader className="p-3 pb-1">
              <div className="flex items-center gap-2">
                <UserList className="size-4 text-chart-3" />
                <CardTitle className="text-xs font-semibold">Páginas do Facebook ({assets.pages.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-1 space-y-1">
              {assets.pages.map((page) => (
                <div key={page.id} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                  <span className="font-medium">{page.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{page.id}</span>
                </div>
              ))}
              {assets.pages.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma página encontrada.</p>}
            </CardContent>
          </Card>

          {/* Contas de Anúncios */}
          <Card className="border-border/60 bg-card shadow-none">
            <CardHeader className="p-3 pb-1">
              <div className="flex items-center gap-2">
                <SquaresFour className="size-4 text-chart-2" />
                <CardTitle className="text-xs font-semibold">Contas de Anúncios ({assets.adAccounts.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-1 space-y-1">
              {assets.adAccounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                  <span className="font-medium">{acc.name}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{acc.currency}</Badge>
                </div>
              ))}
              {assets.adAccounts.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma conta de anúncios associada.</p>}
            </CardContent>
          </Card>

          {/* WhatsApp */}
          {assets.whatsapp && (
            <Card className="border-border/60 bg-card shadow-none">
              <CardHeader className="p-3 pb-1">
                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-emerald-500" />
                  <CardTitle className="text-xs font-semibold">WhatsApp Business Cloud API</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-1 text-xs">
                <p className="font-bold text-foreground">{assets.whatsapp.verifiedName || "Número de Telefone"}</p>
                <p className="font-mono text-muted-foreground">{assets.whatsapp.displayPhoneNumber}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={submitting} className="gap-1.5 font-semibold">
            <CheckCircle className="size-4" /> {submitting ? "Sincronizando..." : "Confirmar & Conectar"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
