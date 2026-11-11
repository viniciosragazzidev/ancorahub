import { describe, expect, it } from "vitest";

import { cleanAdText, hasAdContent, parseGraphAdCreative, parseReferralCreative, safeImageUrl } from "./ad-creative-parse";

describe("criativo do anúncio", () => {
  it("lê título, texto e miniatura do criativo simples", () => {
    expect(parseGraphAdCreative({
      title: "Amil custo-benefício",
      body: "Planos a partir de R$ 89 no Rio",
      thumbnail_url: "https://scontent.xx.fbcdn.net/thumb.jpg",
      image_url: "https://scontent.xx.fbcdn.net/full.jpg",
    })).toEqual({
      title: "Amil custo-benefício",
      body: "Planos a partir de R$ 89 no Rio",
      mediaType: "image",
      imageUrl: "https://scontent.xx.fbcdn.net/thumb.jpg",
    });
  });

  it("cai no object_story_spec quando o criativo não tem título nem texto", () => {
    expect(parseGraphAdCreative({
      object_story_spec: { link_data: { name: "Plano PME", message: "Sua empresa com 2 vidas", picture: "https://cdn.example/p.jpg" } },
    })).toMatchObject({ title: "Plano PME", body: "Sua empresa com 2 vidas", mediaType: "image", imageUrl: "https://cdn.example/p.jpg" });
  });

  it("reconhece vídeo, carrossel e criativo dinâmico", () => {
    expect(parseGraphAdCreative({ video_id: "123", object_story_spec: { video_data: { title: "Vídeo", message: "Assista", image_url: "https://cdn.example/v.jpg" } } }))
      .toMatchObject({ title: "Vídeo", body: "Assista", mediaType: "video", imageUrl: "https://cdn.example/v.jpg" });
    expect(parseGraphAdCreative({ object_story_spec: { link_data: { child_attachments: [{ name: "Card 1", picture: "https://cdn.example/1.jpg" }, { name: "Card 2" }] } } }))
      .toMatchObject({ title: "Card 1", mediaType: "carousel", imageUrl: "https://cdn.example/1.jpg" });
    expect(parseGraphAdCreative({ asset_feed_spec: { titles: [{ text: "Primeiro título" }], bodies: [{ text: "Primeiro texto" }] } }))
      .toMatchObject({ title: "Primeiro título", body: "Primeiro texto" });
  });

  it("sem criativo não inventa nada", () => {
    expect(parseGraphAdCreative(null)).toEqual({ title: null, body: null, mediaType: null, imageUrl: null });
    expect(hasAdContent(parseGraphAdCreative({}))).toBe(false);
  });

  it("só aceita imagem https e corta texto longo", () => {
    expect(safeImageUrl("http://insecure.example/x.jpg")).toBeNull();
    expect(safeImageUrl("javascript:alert(1)")).toBeNull();
    expect(safeImageUrl("https://cdn.example/x.jpg")).toBe("https://cdn.example/x.jpg");
    expect(cleanAdText("a".repeat(200), 160)).toHaveLength(160);
    expect(cleanAdText("   ", 160)).toBeNull();
  });

  it("lê o referral do WhatsApp sem chamar a Graph", () => {
    expect(parseReferralCreative({ headline: "Plano", body: "Texto", media_type: "video", video_url: "https://cdn.example/v.mp4", thumbnail_url: "https://cdn.example/t.jpg" }))
      .toEqual({ title: "Plano", body: "Texto", mediaType: "video", imageUrl: "https://cdn.example/t.jpg" });
  });
});
