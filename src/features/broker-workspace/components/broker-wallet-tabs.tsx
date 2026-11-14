"use client";

import { useRouter } from "next/navigation";

import SegmentedControl from "@/components/arc/segmented-control/segmented-control";

import styles from "./broker-wallet-tabs.module.css";

export type BrokerWalletTab = "atendimento" | "clientes";

const TAB_HREFS: Record<BrokerWalletTab, string> = {
  atendimento: "/leads?tab=minha-fila",
  clientes: "/clientes",
};

/**
 * Minha carteira em uma entrada só (Início do corretor, com a Minha carteira ligada): quem está em atendimento
 * (a fila de leads) e a lista de clientes ficam em duas abas no mesmo lugar, cada uma na sua rota.
 */
export function BrokerWalletTabs({ value, className }: { value: BrokerWalletTab; className?: string }) {
  const router = useRouter();
  return (
    <SegmentedControl
      className={[styles.tabs, className].filter(Boolean).join(" ")}
      label="Minha carteira"
      value={value}
      options={[
        { value: "atendimento", label: "Em atendimento" },
        { value: "clientes", label: "Clientes" },
      ]}
      onValueChange={(next) => {
        if (next !== value) router.push(TAB_HREFS[next as BrokerWalletTab]);
      }}
    />
  );
}
