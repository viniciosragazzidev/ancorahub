import { formatBrokerArrival } from "../../../../src/features/broker-workspace/arrival";
import type { Temperatura } from "../shared/types";

/** Valor da mensalidade em reais; traço quando o servidor não enviou. */
// O Intl põe espaço não separável entre "R$" e o número; vira espaço comum para o texto ficar igual ao do Lite.
export const formatarValor = (valor?: number) =>
  valor === undefined ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor).replace(/ /g, " ");

export const rotuloTemperatura = (temperatura?: Temperatura) =>
  ({ quente: "Quente", morno: "Morno", frio: "Frio", "sem-dados": "Sem dados" })[temperatura ?? "sem-dados"];

/** "hoje 14:05", "há 3 dias" etc., no mesmo formato do Lite do corretor. */
export const chegadaTexto = (iso?: string | null, agora = new Date()) => (iso ? formatBrokerArrival(iso, agora) : null) ?? "—";

export const dataCurta = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

export const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]!.toUpperCase()).join("") || "?";
