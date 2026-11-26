// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { dpoFooterText, isEmptyDpoInput, parseDpo, serializeDpo, validateDpoInput } from "./dpo";
import { DpoFooter } from "./dpo-footer";

describe("encarregado de dados", () => {
  it("exige nome e e-mail válido; telefone é opcional, com DDD", () => {
    expect(validateDpoInput({ name: "Ana Souza", email: "dpo@ancora.com.br", phone: "" })).toEqual({ ok: true, dpo: { name: "Ana Souza", email: "dpo@ancora.com.br", phone: null } });
    expect(validateDpoInput({ name: "", email: "dpo@ancora.com.br" })).toMatchObject({ ok: false, field: "name" });
    expect(validateDpoInput({ name: "Ana", email: "dpo" })).toMatchObject({ ok: false, field: "email" });
    expect(validateDpoInput({ name: "Ana", email: "dpo@ancora.com.br", phone: "1234" })).toMatchObject({ ok: false, field: "phone" });
    expect(validateDpoInput({ name: "  Ana   Souza ", email: " DPO@Ancora.com.br ", phone: "(11) 98888-7777" })).toEqual({ ok: true, dpo: { name: "Ana Souza", email: "dpo@ancora.com.br", phone: "(11) 98888-7777" } });
  });

  it("tudo vazio é apagar o cadastro", () => {
    expect(isEmptyDpoInput({ name: " ", email: "", phone: "" })).toBe(true);
    expect(isEmptyDpoInput({ name: "Ana", email: "", phone: "" })).toBe(false);
  });

  it("lê o que foi salvo e ignora valor quebrado", () => {
    const raw = serializeDpo({ name: "Ana Souza", email: "dpo@ancora.com.br", phone: null, updatedAt: "2026-11-26T12:00:00.000Z" });
    expect(parseDpo(raw)).toEqual({ name: "Ana Souza", email: "dpo@ancora.com.br", phone: null, updatedAt: "2026-11-26T12:00:00.000Z" });
    expect(parseDpo("")).toBeNull();
    expect(parseDpo("{")).toBeNull();
    expect(parseDpo(JSON.stringify({ name: "Ana" }))).toBeNull();
  });
});

describe("rodapé do encarregado", () => {
  afterEach(cleanup);

  it("mostra nome e e-mail, sem o telefone", () => {
    expect(dpoFooterText({ name: "Ana Souza", email: "dpo@ancora.com.br" })).toBe("Encarregado de dados: Ana Souza, dpo@ancora.com.br");
    render(<DpoFooter dpo={{ name: "Ana Souza", email: "dpo@ancora.com.br" }} />);
    const footer = screen.getByTestId("dpo-footer");
    expect(footer.textContent).toBe("Encarregado de dados: Ana Souza, dpo@ancora.com.br");
    expect(screen.getByRole("link", { name: "dpo@ancora.com.br" }).getAttribute("href")).toBe("mailto:dpo@ancora.com.br");
  });

  it("some sem cadastro", () => {
    expect(dpoFooterText(null)).toBeNull();
    expect(dpoFooterText({ name: "Ana", email: " " })).toBeNull();
    const { container } = render(<DpoFooter dpo={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("nunca usa travessão", () => {
    expect(dpoFooterText({ name: "Ana", email: "a@b.co" })).not.toContain("—");
  });
});
