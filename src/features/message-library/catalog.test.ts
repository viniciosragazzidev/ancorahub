import { describe, expect, it } from "vitest";

import { channelValidity, describeUsages, MESSAGE_KIND_LABEL } from "./catalog";

describe("message library catalog", () => {
  it("states where each kind of message is valid", () => {
    expect(channelValidity("meta_template").map((item) => [item.channel, item.valid])).toEqual([["meta", "always"], ["company_number", "never"]]);
    expect(channelValidity("free_message").map((item) => [item.channel, item.valid])).toEqual([["meta", "window"], ["company_number", "always"]]);
    expect(channelValidity("quick_reply").every((item) => item.valid === "window")).toBe(true);
  });

  it("names kinds and usages in plain words", () => {
    expect(MESSAGE_KIND_LABEL.free_message).toBe("Mensagem livre");
    expect(describeUsages([{ area: "team_notice", label: "Aviso da equipe: Lead atribuído" }, { area: "situation", label: "Situação: Primeiro contato" }])).toBe("Aviso da equipe: Lead atribuído · Situação: Primeiro contato");
  });
});
