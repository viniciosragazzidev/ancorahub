/**
 * Banner do fim do Início do corretor (14/11/2026): fecha a tela com um convite, no mesmo desenho do banner da
 * Minha jornada. Com uma missão da semana, mostra quanto falta e leva a ela; sem missão, convida para a jornada
 * (com a chave dela ligada) ou para o desempenho. Nunca aparece para supervisor e gestor (o Início deles não chama).
 */
import { CaptainBanner } from "@/components/lite/banner/captain-banner";

import type { HomeHighlights } from "./week-ranking";

export function HomeBanner({ highlights, className }: { highlights: HomeHighlights | null; className?: string }) {
  const mission = highlights?.mission ?? null;
  const progress = mission?.progress ?? null;
  if (mission && progress && !progress.completed) {
    const remaining = Math.max(0, progress.remaining);
    return <CaptainBanner className={className} label="Missão da semana" title={`${mission.title}: bora fechar essa?`}
      goal={{ value: `Falta${remaining === 1 ? "" : "m"} ${remaining.toLocaleString("pt-BR")}`, hint: `${progress.progress} de ${progress.target} feitos` }}
      progress={progress.percentage} action={{ label: "Ver a missão", href: mission.href }} />;
  }
  if (mission && progress?.completed) {
    return <CaptainBanner className={className} label="Missão da semana" title="Missão da semana cumprida. Que tal a próxima?"
      goal={{ value: "Concluída", hint: mission.title }} progress={100}
      action={{ label: "Ver minha jornada", href: highlights?.journeyHref ?? mission.href }} />;
  }
  if (highlights?.journeyHref) {
    return <CaptainBanner className={className} label="Minha jornada" title="Cada atendimento vira ponto. Bora subir de nível?"
      action={{ label: "Ver minha jornada", href: highlights.journeyHref }} />;
  }
  return <CaptainBanner className={className} label="Meu desempenho" title="Bora fazer o dia de hoje valer?"
    goal={{ value: "Seus números do dia", hint: "e da semana" }} action={{ label: "Ver meu desempenho", href: "/desempenho" }} />;
}
