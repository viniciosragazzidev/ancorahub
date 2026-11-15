import { describe, expect, it } from "vitest";

import { announcementSchema, isAnnouncementLive, type HomeAnnouncementInput } from "./announcement";

const base: HomeAnnouncementInput = { active: true, title: "Campanha no ar", body: "Bora!", button: null, art: "tesouro", tone: "navy", endsOn: null };

describe("aviso do Início", () => {
  it("fica no ar ligado e sem data final", () => {
    expect(isAnnouncementLive(base, "2026-11-15")).toBe(true);
  });

  it("sai do ar desligado, sem título ou depois do último dia", () => {
    expect(isAnnouncementLive({ ...base, active: false }, "2026-11-15")).toBe(false);
    expect(isAnnouncementLive({ ...base, title: "  " }, "2026-11-15")).toBe(false);
    expect(isAnnouncementLive({ ...base, endsOn: "2026-11-15" }, "2026-11-15")).toBe(true);
    expect(isAnnouncementLive({ ...base, endsOn: "2026-11-14" }, "2026-11-15")).toBe(false);
    expect(isAnnouncementLive(null, "2026-11-15")).toBe(false);
  });

  it("aceita link do sistema ou https e recusa o resto", () => {
    const withHref = (href: string) => announcementSchema.safeParse({ ...base, button: { label: "Ver", href } }).success;
    expect(withHref("/jornada")).toBe(true);
    expect(withHref("https://ancorasaude.com.br/campanha")).toBe(true);
    expect(withHref("javascript:alert(1)")).toBe(false);
    expect(withHref("//outro.site")).toBe(false);
    expect(withHref("http://inseguro.com")).toBe(false);
  });

  it("recusa personagem e cor fora da lista", () => {
    expect(announcementSchema.safeParse({ ...base, art: "outro" }).success).toBe(false);
    expect(announcementSchema.safeParse({ ...base, tone: "red" }).success).toBe(false);
  });
});
