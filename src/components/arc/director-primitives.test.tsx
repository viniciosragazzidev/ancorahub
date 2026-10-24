// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AppCombobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StatefulButton } from "@/components/ui/stateful-button";
import { ScrollBar } from "@/components/ui/scroll-area";
import { StatCard } from "@/components/dashboard/metric-card";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { Toaster } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArcScopeProvider } from "./arc-scope-context";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

function ScrollbarFixture() {
  return (
    <ScrollAreaPrimitive.Root type="always" style={{ height: 48, width: 100 }}>
      <ScrollAreaPrimitive.Viewport style={{ height: 48, width: 100 }}>
        <div style={{ height: 160 }}>Conteudo longo</div>
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar forceMount orientation="vertical" />
    </ScrollAreaPrimitive.Root>
  );
}

// Baseline fixture snapshot gerado no commit 71e631f3 de origin/feat/diretor-visual-lite.
function OriginHTMLSnapshotFixture() {
  return (
    <>
      <section aria-label="Button"><Button variant="outline" size="sm">Salvar</Button></section>
      <section aria-label="Card">
        <Card variant="subtle" size="sm"><CardHeader><CardTitle>Resumo</CardTitle></CardHeader><CardContent>Conteudo</CardContent></Card>
      </section>
      <section aria-label="MetricCard"><StatCard label="Leads do dia" value={12} sublabel="Recebidos hoje" /></section>
      <section aria-label="Sonner"><Toaster /></section>
      <section aria-label="ScrollArea"><ScrollbarFixture /></section>
      <section aria-label="Combobox">
        <AppCombobox aria-label="Status" defaultValue="ativo" options={[{ value: "ativo", label: "Ativo" }, { value: "pausado", label: "Pausado" }]} />
      </section>
      <section aria-label="AnimatedBadge"><AnimatedBadge status="success">Conectado</AnimatedBadge></section>
    </>
  );
}

describe("pele das primitivas do Diretor", () => {
  it("mantem LightChrome e as duas folhas da pele estaticos no shell", () => {
    const shell = readFileSync(join(process.cwd(), "src/components/app-shell.tsx"), "utf8");
    expect(shell).toMatch(/import\s+\{\s*LightChrome\s*\}\s+from\s+["']@\/components\/light\/light-chrome["']/);
    expect(shell).toContain('import "@/components/arc/director-skin.css";');
    expect(shell).toContain('import "@/components/arc/director-primitives.css";');
    expect(shell).not.toContain("DirectorLiteStyleGate");
    expect(shell).not.toMatch(/const LightChrome\s*=\s*dynamic/);
  });

  it("preserva o HTML legado sem provider para as sete primitivas", async () => {
    vi.stubGlobal("ResizeObserver", class ResizeObserverMock { observe() {} unobserve() {} disconnect() {} });
    render(<OriginHTMLSnapshotFixture />);
    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    await screen.findByRole("button", { name: "Ativo" });

    expect(screen.getByRole("button", { name: "Salvar" })).not.toHaveAttribute("data-variant");
    const card = screen.getByText("Resumo").closest('[data-slot="card"]');
    expect(card).toHaveAttribute("data-variant", "subtle");
    expect(card).toHaveAttribute("data-size", "sm");
    expect(screen.getByText("Leads do dia").closest('[data-slot="card"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="sonner"]')).toBeNull();
    expect(document.querySelector('[data-slot="scroll-area-thumb"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Ativo" })).not.toHaveAttribute("data-slot", "combobox-option");
    expect(document.querySelector('[data-slot="animated-badge"]')).toBeNull();
    expect(document.body.innerHTML).toMatchSnapshot();
  });

  it("so emite atributos de skin nos componentes quando o escopo esta ativo", () => {
    vi.stubGlobal("ResizeObserver", class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    const { container } = render(
      <>
        <Button variant="outline" size="sm">Salvar</Button>
        <StatefulButton variant="outline" size="sm">Continuar</StatefulButton>
        <Card onClick={() => undefined} tabIndex={0}>Cliente</Card>
        <StatCard label="Leads" value={12} />
        <AnimatedBadge status="success">Ativo</AnimatedBadge>
        <ScrollbarFixture />
      </>,
    );

    expect(screen.getByRole("button", { name: "Salvar" })).not.toHaveAttribute("data-variant");
    expect(screen.getByRole("button", { name: "Continuar" })).not.toHaveAttribute("data-size");
    expect(screen.getByText("Cliente")).not.toHaveAttribute("data-interactive");
    expect(screen.getByText("Leads").closest("[data-slot]")).toHaveAttribute("data-slot", "card");
    expect(screen.getByText("Ativo").closest("span.relative.inline-flex")).not.toHaveAttribute("data-slot", "animated-badge");
    expect(container.querySelector('[data-slot="scroll-area-thumb"]')).toBeNull();

    cleanup();
    const { container: enabledContainer } = render(
      <ArcScopeProvider enabled>
        <>
          <Button variant="outline" size="sm">Salvar</Button>
          <StatefulButton variant="outline" size="sm">Continuar</StatefulButton>
          <Card onClick={() => undefined} tabIndex={0}>Cliente</Card>
          <StatCard label="Leads" value={12} />
          <AnimatedBadge status="success">Ativo</AnimatedBadge>
          <ScrollbarFixture />
        </>
      </ArcScopeProvider>,
    );

    expect(screen.getByRole("button", { name: "Salvar" })).toHaveAttribute("data-variant", "outline");
    expect(screen.getByRole("button", { name: "Continuar" })).toHaveAttribute("data-size", "sm");
    expect(screen.getByText("Cliente")).toHaveAttribute("data-interactive", "true");
    expect(screen.getByText("Leads").closest("[data-slot]")).toHaveAttribute("data-slot", "stat-card");
    expect(screen.getByText("Ativo").closest('[data-slot="animated-badge"]')).toHaveAttribute("data-status", "success");
    expect(enabledContainer.querySelector('[data-slot="scroll-area-thumb"]')).not.toBeNull();
  });

  it("so marca opcao e sonner com o escopo ativo", () => {
    render(
      <>
        <AppCombobox aria-label="Status" defaultValue="ativo" options={[{ value: "ativo", label: "Ativo" }]} />
        <Toaster />
      </>,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    const inactiveOption = screen.getByRole("button", { name: "Ativo" });
    expect(inactiveOption).not.toHaveAttribute("data-slot", "combobox-option");
    expect(inactiveOption).not.toHaveAttribute("data-selected");
    expect(document.querySelector('[data-slot="sonner"]')).toBeNull();

    cleanup();
    render(
      <ArcScopeProvider enabled>
        <>
          <AppCombobox aria-label="Status" defaultValue="ativo" options={[{ value: "ativo", label: "Ativo" }]} />
          <Toaster directorLiteEnabled />
        </>
      </ArcScopeProvider>,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    const activeOption = screen.getByRole("button", { name: "Ativo" });
    expect(activeOption).toHaveAttribute("data-slot", "combobox-option");
    expect(activeOption).toHaveAttribute("data-selected", "true");
    expect(document.querySelector('[data-slot="sonner"]')).not.toBeNull();
  });

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

  it("mantem cada seletor da folha dentro do escopo do Diretor", () => {
    const source = readFileSync(join(process.cwd(), "src/components/arc/director-primitives.css"), "utf8");
    const blocks = source.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(?:^|})\s*([^{}]+)\{/gm);
    const selectors = [...blocks]
      .map((match) => match[1].trim())
      .filter((selector) => !selector.startsWith("@"))
      .flatMap((selector) => selector.split(",").map((part) => part.trim()));

    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector, selector).toContain('[data-skin="diretor"]');
    }
  });

  it("mantem o thumb estreito e arredondado sem alterar a trilha", () => {
    const source = readFileSync(join(process.cwd(), "src/components/arc/director-primitives.css"), "utf8");
    expect(source).toMatch(/\[data-slot="scroll-area-scrollbar"\]\s*\{\s*opacity:\s*1;/);
    expect(source.match(/border-radius:\s*999px;/g)).toHaveLength(2);
    expect(source).not.toMatch(/\[data-slot="scroll-area-scrollbar"\]\s*\{[^}]*\b(?:width|height):/);
    expect(source).toContain('[data-skin="diretor"] .director-scroll-area-demo');
    expect(source).toContain('border: 1px solid var(--border);');
    expect(source).toContain('border-radius: var(--radius-panel);');
    expect(source).toContain('[data-skin="diretor"] .director-scroll-area-demo-row');
    expect(source).toContain('background: transparent;');
    expect(source).toContain('[data-skin="diretor"] .director-scroll-area-demo-row + .director-scroll-area-demo-row');
    const scrollArea = readFileSync(join(process.cwd(), "src/components/ui/scroll-area.tsx"), "utf8");
    expect(scrollArea).toContain('orientation === "vertical" && "h-full w-2 border-l border-l-transparent p-px"');
  });

  it("troca os cinco focos dos menus somente no escopo do Diretor", () => {
    const source = readFileSync(join(process.cwd(), "src/components/ui/dropdown-menu.tsx"), "utf8");
    expect(source.match(/const focusBackground = directorLite \? "focus:bg-muted" : "focus:bg-accent"/g)).toHaveLength(4);
    expect(source.match(/\$\{focusBackground\}/g)).toHaveLength(5);
  });

  it("mantem os fundos de foco antigos sem chave e usa muted com a chave", () => {
    const menu = (
      <DropdownMenu open>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
          <DropdownMenuSub open>
            <DropdownMenuSubTrigger>Submenu</DropdownMenuSubTrigger>
            <DropdownMenuSubContent><DropdownMenuItem>Subitem</DropdownMenuItem></DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuCheckboxItem checked={false}>Caixa</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="um"><DropdownMenuRadioItem value="um">Radio</DropdownMenuRadioItem></DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    render(menu);
    const legacyClasses = [...document.querySelectorAll<HTMLElement>(
      '[data-slot="dropdown-menu-item"], [data-slot="dropdown-menu-sub-trigger"], [data-slot="dropdown-menu-checkbox-item"], [data-slot="dropdown-menu-radio-item"]',
    )].map((element) => element.className);
    expect(legacyClasses.length).toBe(5);
    expect(legacyClasses.every((className) => className.includes("focus:bg-accent"))).toBe(true);
    cleanup();

    render(<ArcScopeProvider enabled>{menu}</ArcScopeProvider>);
    const directorClasses = [...document.querySelectorAll<HTMLElement>(
      '[data-slot="dropdown-menu-item"], [data-slot="dropdown-menu-sub-trigger"], [data-slot="dropdown-menu-checkbox-item"], [data-slot="dropdown-menu-radio-item"]',
    )].map((element) => element.className);
    expect(directorClasses.length).toBe(5);
    expect(directorClasses.every((className) => className.includes("focus:bg-muted"))).toBe(true);
    expect(directorClasses.some((className) => className.includes("focus:bg-accent"))).toBe(false);
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
