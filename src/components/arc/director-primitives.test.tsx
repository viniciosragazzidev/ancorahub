// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

function htmlSnapshot() {
  const { container } = render(<PrimitiveSet />);
  const snapshot = container.innerHTML;
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

describe("pele das primitivas do Diretor", () => {
  it("mantem LightChrome e as duas folhas da pele estaticos no shell", () => {
    const shell = readFileSync(join(process.cwd(), "src/components/app-shell.tsx"), "utf8");
    expect(shell).toMatch(/import\s+\{\s*LightChrome\s*\}\s+from\s+["']@\/components\/light\/light-chrome["']/);
    expect(shell).toContain('import "@/components/arc/director-skin.css";');
    expect(shell).toContain('import "@/components/arc/director-primitives.css";');
    expect(shell).not.toContain("DirectorLiteStyleGate");
    expect(shell).not.toMatch(/const LightChrome\s*=\s*dynamic/);
  });

  it("mantem o HTML sem escopo igual a referencia da origin", () => {
    expect(htmlSnapshot()).toMatchInlineSnapshot(`"<button data-slot="button" type="button" class="ct-press group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-xs font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,scale] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 motion-reduce:transition-none [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 [&amp;_svg:not([class*='size-'])]:size-4 cursor-pointer bg-primary text-primary-foreground shadow-none hover:bg-primary/90 h-9 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5">Salvar</button><input id="base-ui-_r_0_" data-slot="input" aria-label="Nome" class="h-8 w-full min-w-0 rounded-full border border-input bg-card px-2.5 py-1.5 text-xs text-foreground shadow-none transition-[background-color,border-color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 motion-reduce:transition-none dark:bg-card dark:border-border"><div class="relative inline-block w-full"><div class="relative inline-block w-full"><button data-slot="select-trigger" type="button" id="_r_1_-trigger" aria-label="Plano" aria-haspopup="listbox" aria-expanded="false" aria-controls="_r_1_-list" class="relative z-10 flex w-full items-center justify-between gap-2 rounded-[10px] border border-input bg-card px-3 text-foreground outline-none transition-colors select-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50 h-8 py-1.5 text-xs !rounded-full"><span class="truncate text-left flex-1 text-muted-foreground">Selecione...</span><span aria-hidden="true" animate="[object Object]" transition="[object Object]" class="text-muted-foreground shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-4 w-4" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></span></button></div></div><span data-unchecked="" role="checkbox" tabindex="0" id="base-ui-_r_2_" aria-checked="false" data-slot="checkbox" aria-label="Selecionar" class="peer relative flex size-4 shrink-0 items-center justify-center rounded-md border border-input transition-[background-color,border-color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary bg-card dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary"><span data-unchecked="" data-slot="checkbox-indicator" class="grid place-content-center text-current [&amp;>svg]:size-3.5"><span class="inline-flex shrink-0 items-center justify-center"><div class="inline-flex size-full items-center justify-center [&amp;_svg]:size-full"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 14L8.5 17.5L19 6.5" variants="[object Object]" animate="[object Object]"></path></svg></div></span></span></span><input style="clip-path: inset(50%); overflow: hidden; white-space: nowrap; border: 0px; padding: 0px; width: 1px; height: 1px; margin: -1px; position: fixed; top: 0px; left: 0px;" tabindex="-1" aria-hidden="true" type="checkbox"><span data-unchecked="" role="switch" tabindex="0" id="base-ui-_r_5_" aria-checked="false" data-slot="switch" aria-label="Ativar" class="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-[var(--motion-duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-primary data-unchecked:bg-muted"><span data-unchecked="" data-slot="switch-thumb" class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-[var(--shadow-xs)] ring-0 transition-transform duration-[var(--motion-duration-fast)] data-checked:translate-x-4 data-unchecked:translate-x-0"></span></span><input id="base-ui-_r_6_" style="clip-path: inset(50%); overflow: hidden; white-space: nowrap; border: 0px; padding: 0px; width: 1px; height: 1px; margin: -1px; position: fixed; top: 0px; left: 0px;" tabindex="-1" aria-hidden="true" type="checkbox"><div class="flex flex-col gap-2"><div role="tablist" class="inline-flex w-full items-center gap-1 overflow-x-auto border-b border-border bg-transparent [scrollbar-width:none] [&amp;::-webkit-scrollbar]:hidden"><button type="button" role="tab" data-slot="tabs-trigger" aria-selected="true" class="relative isolate inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap px-2 pb-2.5 pt-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-foreground">Hoje<span layoutid="_r_8_" class="absolute -bottom-px left-0 right-0 h-0.5 bg-primary"></span></button></div></div>"`);
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
