import type { ReactNode } from "react";
/**
 * Banner do fim do Início do corretor (14/11/2026): fecha a tela com um convite, no mesmo desenho do banner da
 * Minha jornada. Com uma missão da semana, mostra quanto falta e leva a ela; sem missão, convida para a jornada
 * (com a chave dela ligada) ou para o desempenho. Nunca aparece para supervisor e gestor (o Início deles não chama).
 */
import { CaptainBanner } from "@/components/lite/banner/captain-banner";
import { announcementArt, type HomeAnnouncementView } from "@/features/home-announcement/announcement";

import type { HomeHighlights } from "./week-ranking";

/** Aviso publicado pela diretoria (Relacionamento > Aviso do Início, 15/11/2026): título, texto, botão, personagem e cor. */
export function AnnouncementBanner({ announcement, className }: { announcement: HomeAnnouncementView; className?: string }) {
  return <CaptainBanner className={className} label="Aviso da diretoria" title={announcement.title} subtitle={announcement.body || undefined}
    art={announcementArt(announcement.art)} tone={announcement.tone} action={announcement.button ?? undefined} />;
}

export function HomeBanner({ highlights, announcement = null, className }: { highlights: HomeHighlights | null; announcement?: HomeAnnouncementView | null; className?: string }) {
  if (announcement) return <AnnouncementBanner announcement={announcement} className={className} />;
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
  return <CaptainBanner className={className} label="Meu desempenho" title="Bora fazer o dia de hoje valer? Seus números estão aqui."
    action={{ label: "Ver meu desempenho", href: "/desempenho" }} />;
}

/**
 * Boas-vindas do Início no computador (14/11/2026): o banner abre a tela, no topo, no lugar do título solto. A frase
 * cumprimenta pelo nome; o selo e o atalho levam à missão da semana, quando houver; sem missão, o atalho leva à fila.
 */
export function HomeWelcomeBanner({ greeting, firstName, highlights, subtitle, duty, goal: dayGoal, nextAction, nextActionSlot, className }: {
  greeting: string;
  firstName: string;
  highlights: HomeHighlights | null;
  /** O próximo passo do dia (antes ficava solto sob o banner). */
  subtitle?: ReactNode;
  duty?: { title: string; detail: string } | null;
  goal?: { name: string; currentValue: string; targetValue: string; percentage: number } | null;
  /** O próximo passo vira o botão do banner (15/11/2026), no lugar do botão azul que ficava embaixo. */
  nextAction?: { label: string; href: string } | null;
  nextActionSlot?: (className: string) => ReactNode;
  className?: string;
}) {
  const mission = highlights?.mission ?? null;
  // Os números do dia já estão nos cartões logo abaixo: o selo mostra a missão da semana, quando houver.
  const open = mission && mission.progress && !mission.progress.completed ? mission.progress : null;
  const goal = open ? { value: `Falta${open.remaining === 1 ? "" : "m"} ${Math.max(0, open.remaining).toLocaleString("pt-BR")}`, hint: mission!.title } : undefined;
  const action = nextAction ?? (open && mission
    ? { label: "Ver a missão", href: mission.href }
    : { label: "Ver minha fila", href: "/minha-fila" });
  // Fatos do dia e da semana (15/11/2026): o que não está nos cartões de números logo abaixo.
  const best = highlights?.ranks.length ? [...highlights.ranks].sort((a, b) => a.position / a.total - b.position / b.total)[0] : null;
  const dutyFact = duty ? { label: duty.title.split(":")[0], value: duty.detail } : { label: "Plantão", value: "Nenhum marcado" };
  const facts = [
    dutyFact,
    dayGoal ? { label: dayGoal.name, value: `${dayGoal.currentValue} de ${dayGoal.targetValue} · ${dayGoal.percentage}%` } : null,
    best ? { label: "Sua semana", value: `${best.position}º ${best.label}` } : null,
    highlights?.acceptTime ? { label: "Aceite médio", value: highlights.acceptTime } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);
  return <CaptainBanner className={className} label="Boas-vindas" title={`${greeting}, ${firstName}! Que bom ter você aqui.`} subtitle={subtitle} facts={facts} goal={goal} action={action} actionSlot={nextActionSlot} />;
}
