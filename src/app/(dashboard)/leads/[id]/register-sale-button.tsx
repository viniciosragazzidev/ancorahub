"use client";

import { useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";

import { RegisterSalePanel } from "./register-sale-panel";

type ConfirmationDocument = { id: string; filename: string; status: string };
type CarrierOption = { id: string; name: string };

/** Director or manager registering the sale of a broker's lead; the sale and commissions stay with the broker. */
export function RegisterSaleButton({
  leadId,
  documents,
  carriers,
  size = "sm",
}: {
  leadId: string;
  documents: ConfirmationDocument[];
  carriers: CarrierOption[];
  size?: ComponentProps<typeof Button>["size"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)}>
        Registrar venda
      </Button>
      <RegisterSalePanel leadId={leadId} documents={documents} carriers={carriers} open={open} onOpenChange={setOpen} />
    </>
  );
}
