/**
 * Aviso do Início (15/11/2026): o diretor escreve um anúncio em Relacionamento e ele ocupa o banner do capitão no
 * Início de todos os corretores da empresa (computador e celular). Título, texto, um botão com link, o personagem e a
 * cor do banner. Guardado em system_settings por empresa (sem migração): `home-announcement:<tenantId>`.
 */
import { z } from "zod";

import type { CaptainBannerArt } from "@/components/lite/banner/captain-banner";

export const ANNOUNCEMENT_ARTS = {
  tesouro: { label: "Capitão com o baú", art: { src: "/mascote/venda-capitao.webp", width: 584, height: 640 } },
  trono: { label: "Capitão no trono", art: { src: "/mascote/financeiro-trono.webp", width: 640, height: 585 } },
  mirando: { label: "Capitão na luneta", art: { src: "/mascote/desempenho-mirando.webp", width: 640, height: 561 } },
  subindo: { label: "Capitão subindo", art: { src: "/mascote/desempenho-subindo.webp", width: 640, height: 557 } },
  acenando: { label: "Capitão acenando", art: { src: "/mascote/splash-capitao.webp", width: 645, height: 735 } },
} as const satisfies Record<string, { label: string; art: CaptainBannerArt }>;

export type AnnouncementArtId = keyof typeof ANNOUNCEMENT_ARTS;
export const ANNOUNCEMENT_ART_IDS = Object.keys(ANNOUNCEMENT_ARTS) as AnnouncementArtId[];

/** As três cores do banner do capitão (tokens do próprio banner; nenhuma cor nova). */
export const ANNOUNCEMENT_TONES = {
  navy: "Azul-marinho",
  light: "Azul claro",
  white: "Branco",
} as const;
export type AnnouncementTone = keyof typeof ANNOUNCEMENT_TONES;

/** Link do botão: caminho do próprio sistema ("/jornada") ou endereço https. */
const href = z.string().trim().max(500).refine(
  (value) => /^\/(?!\/)[^\s]*$/.test(value) || /^https:\/\/[^\s]+$/.test(value),
  "Use um caminho do sistema (começando com /) ou um endereço https://.",
);

export const announcementSchema = z.object({
  active: z.boolean(),
  title: z.string().trim().min(3, "Escreva um título.").max(80, "Título com até 80 caracteres."),
  body: z.string().trim().max(240, "Texto com até 240 caracteres.").default(""),
  button: z.object({
    label: z.string().trim().min(2, "Escreva o texto do botão.").max(30, "Botão com até 30 caracteres."),
    href,
  }).nullable(),
  art: z.enum(ANNOUNCEMENT_ART_IDS as [AnnouncementArtId, ...AnnouncementArtId[]]),
  tone: z.enum(["navy", "light", "white"]),
  /** Último dia no ar ("AAAA-MM-DD", horário de São Paulo); vazio = até tirar do ar. */
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable(),
});

export type HomeAnnouncementInput = z.infer<typeof announcementSchema>;
export type HomeAnnouncement = HomeAnnouncementInput & { updatedAt: string | null };

/** O que o Início recebe: só o necessário para desenhar o banner. */
export type HomeAnnouncementView = Pick<HomeAnnouncement, "title" | "body" | "button" | "art" | "tone">;

export const EMPTY_ANNOUNCEMENT: HomeAnnouncementInput = {
  active: false,
  title: "",
  body: "",
  button: null,
  art: "tesouro",
  tone: "navy",
  endsOn: null,
};

export function announcementArt(id: AnnouncementArtId): CaptainBannerArt {
  return (ANNOUNCEMENT_ARTS[id] ?? ANNOUNCEMENT_ARTS.tesouro).art;
}

/** No ar agora: ligado e, se tiver data final, ainda não passou (comparado no dia de São Paulo). */
export function isAnnouncementLive(announcement: HomeAnnouncementInput | null, today: string): boolean {
  if (!announcement?.active || !announcement.title.trim()) return false;
  return !announcement.endsOn || announcement.endsOn >= today;
}
