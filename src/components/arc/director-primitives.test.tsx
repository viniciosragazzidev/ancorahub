// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArcScopeProvider } from "./arc-scope-context";

afterEach(cleanup);

function PrimitiveSet() {
  return (
    <>
      <Button>Salvar</Button>
      <Input aria-label="Nome" />
      <AppSelect aria-label="Plano" options={[{ value: "a", label: "Plano A" }]} />
      <Checkbox aria-label="Selecionar" />
      <Switch aria-label="Ativar" />
      <Tabs defaultValue="hoje"><TabsList><TabsTrigger value="hoje">Hoje</TabsTrigger></TabsList></Tabs>
    </>
  );
}

function classSnapshot(enabled?: boolean) {
  const content = <PrimitiveSet />;
  const { container } = render(
    enabled === undefined ? content : <ArcScopeProvider enabled={enabled}>{content}</ArcScopeProvider>,
  );
  const snapshot = [...container.querySelectorAll<HTMLElement>("[data-slot]")].map((element) => [
    element.getAttribute("data-slot"),
    element.className,
  ]);
  cleanup();
  return snapshot;
}

describe("pele das primitivas do Diretor", () => {
  it("mantém as classes legadas quando o provider está desligado", () => {
    expect(classSnapshot(false)).toEqual(classSnapshot());
  });

  it("mede alvos de toque em 44 px no escopo do Diretor", () => {
    const source = readFileSync(join(process.cwd(), "src/components/arc/director-primitives.css"), "utf8");
    for (const slot of ["button", "input", "select-trigger", "checkbox", "switch", "tabs-trigger"]) {
      expect(source).toContain('[data-skin="diretor"] [data-slot="' + slot + '"]');
    }
    expect(source).toContain("--control-height-sm");
    const skin = readFileSync(join(process.cwd(), "src/components/arc/director-skin.css"), "utf8");
    expect(skin).toContain("--control-height-sm: 44px");
  });

  it("mantém os seis controles navegáveis por teclado", () => {
    render(<ArcScopeProvider enabled><PrimitiveSet /></ArcScopeProvider>);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Nome" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Plano" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Selecionar" })).toBeVisible();
    expect(screen.getByRole("switch", { name: "Ativar" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Hoje" })).toBeVisible();
  });
});
