"use client";

/**
 * LiteSelect ligado a um parâmetro da URL (unidade, período, status...), com a mesma navegação dos seletores atuais:
 * preserva os outros parâmetros, apaga o parâmetro no valor padrão e, se pedido, volta para a página 1.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { LiteSelect, type LiteOption } from "./select";

export function LiteUrlSelect({ label, param, value, options, defaultValue = "", method = "push", resetPage = false, className }: {
  label: string;
  param: string;
  value: string;
  options: LiteOption[];
  /** Valor que some da URL (ex.: "" para todas, "30" para o período padrão). */
  defaultValue?: string;
  method?: "push" | "replace";
  resetPage?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startNavigation] = useTransition();
  const select = (next: string) => {
    const query = new URLSearchParams(params.toString());
    if (next === defaultValue) query.delete(param);
    else query.set(param, next);
    if (resetPage) query.delete("page");
    const target = `${pathname ?? ""}${query.toString() ? `?${query.toString()}` : ""}`;
    startNavigation(() => (method === "push" ? router.push(target, { scroll: false }) : router.replace(target, { scroll: false })));
  };
  return (
    <div className={className}>
      <LiteSelect label={label} hideLabel value={value} onChange={select} options={options} />
    </div>
  );
}
