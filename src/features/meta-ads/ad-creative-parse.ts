/**
 * O que o cliente viu no anúncio, lido do criativo da Graph (10/11/2026).
 * Só conteúdo público: título, texto, imagem e tipo de mídia.
 */

export type AdCreativeContent = {
  title: string | null;
  body: string | null;
  mediaType: "image" | "video" | "carousel" | null;
  imageUrl: string | null;
};

type TextAsset = { text?: string };
type LinkData = {
  name?: string;
  message?: string;
  description?: string;
  picture?: string;
  child_attachments?: Array<{ name?: string; description?: string; picture?: string }>;
};
type VideoData = { title?: string; message?: string; image_url?: string };

export type GraphAdCreative = {
  title?: string;
  body?: string;
  image_url?: string;
  thumbnail_url?: string;
  video_id?: string;
  object_type?: string;
  object_story_spec?: { link_data?: LinkData; video_data?: VideoData };
  asset_feed_spec?: { titles?: TextAsset[]; bodies?: TextAsset[]; images?: Array<{ url?: string }>; videos?: unknown[] };
};

export const AD_TITLE_MAX = 160;
export const AD_BODY_MAX = 1000;

/** Texto limpo de uma linha por parágrafo, cortado no limite. */
export function cleanAdText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Só https: a imagem vai para o navegador do corretor. */
export function safeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url || url.length > 2000) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function firstText(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

export function parseGraphAdCreative(creative: GraphAdCreative | null | undefined): AdCreativeContent {
  const link = creative?.object_story_spec?.link_data;
  const video = creative?.object_story_spec?.video_data;
  const feed = creative?.asset_feed_spec;
  const child = link?.child_attachments?.[0];

  const isVideo = Boolean(creative?.video_id || video || feed?.videos?.length || creative?.object_type === "VIDEO");
  const isCarousel = Boolean(link?.child_attachments?.length && link.child_attachments.length > 1);

  return {
    title: cleanAdText(firstText(creative?.title, link?.name, video?.title, feed?.titles?.[0]?.text, child?.name), AD_TITLE_MAX),
    body: cleanAdText(firstText(creative?.body, link?.message, video?.message, feed?.bodies?.[0]?.text, link?.description, child?.description), AD_BODY_MAX),
    mediaType: isVideo ? "video" : isCarousel ? "carousel" : creative ? "image" : null,
    // A miniatura pedida em 600 px é a mais nítida; as outras são fallback.
    imageUrl: safeImageUrl(firstText(creative?.thumbnail_url, creative?.image_url, link?.picture, child?.picture, video?.image_url, feed?.images?.[0]?.url)),
  };
}

/** O referral do clique no anúncio de WhatsApp traz o mesmo conteúdo, sem chamar a Graph. */
export function parseReferralCreative(referral: {
  headline?: string | null;
  body?: string | null;
  media_type?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
}): AdCreativeContent {
  const media = referral.media_type?.toLowerCase();
  return {
    title: cleanAdText(referral.headline, AD_TITLE_MAX),
    body: cleanAdText(referral.body, AD_BODY_MAX),
    mediaType: media === "video" ? "video" : media === "image" ? "image" : null,
    imageUrl: safeImageUrl(referral.thumbnail_url ?? referral.image_url),
  };
}

export function hasAdContent(content: Pick<AdCreativeContent, "title" | "body" | "imageUrl">) {
  return Boolean(content.title || content.body || content.imageUrl);
}
