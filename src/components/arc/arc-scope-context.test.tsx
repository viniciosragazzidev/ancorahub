// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { AttachmentUpload } from "@/components/motion/attachment-upload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select";
import { useSuccessOverlay } from "@/components/motion/success-overlay";
import { AppCombobox } from "@/components/ui/combobox";
import { CommandDialog } from "@/components/ui/command";
import {
  Dialog,
  DialogPopup,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BottomSheet } from "./bottom-sheet/bottom-sheet";
import {
  ArcScopeProvider,
  DIRECTOR_LITE_PORTAL_ROOT_ID,
  getArcScopeProps,
} from "./arc-scope-context";

afterEach(() => {
  cleanup();
  document.getElementById(DIRECTOR_LITE_PORTAL_ROOT_ID)?.remove();
});

function SuccessOverlayHarness() {
  const { celebrate, node } = useSuccessOverlay();
  return (
    <>
      <button type="button" onClick={() => celebrate("Ação concluída")}>Celebrar</button>
      {node}
    </>
  );
}

type RenderCase = {
  name: string;
  element: () => ReactElement;
  selectors: string[];
  open?: () => void;
};

const cases: RenderCase[] = [
  {
    name: "dialog",
    element: () => <Dialog open><DialogPopup><p>Diálogo</p></DialogPopup></Dialog>,
    selectors: ['[data-slot="dialog-popup"]', '[data-slot="dialog-overlay"]'],
  },
  {
    name: "sheet",
    element: () => <Sheet open><SheetContent showCloseButton={false}>Painel lateral</SheetContent></Sheet>,
    selectors: ['[data-slot="sheet-content"]', '[data-slot="sheet-overlay"]'],
  },
  {
    name: "drawer",
    element: () => <Drawer open><DrawerContent>Gaveta</DrawerContent></Drawer>,
    selectors: ['[data-slot="drawer-popup"]', '[data-slot="drawer-overlay"]', '[data-slot="drawer-viewport"]'],
  },
  {
    name: "popover",
    element: () => <Popover open><PopoverContent>Opções</PopoverContent></Popover>,
    selectors: ['[data-slot="popover-content"]', '[role="presentation"].isolate[data-side]'],
  },
  {
    name: "dropdown Content",
    element: () => <DropdownMenu open><DropdownMenuContent>Opções</DropdownMenuContent></DropdownMenu>,
    selectors: ['[data-slot="dropdown-menu-content"]', '[role="presentation"].isolate[data-side]'],
  },
  {
    name: "dropdown SubContent",
    element: () => (
      <DropdownMenu open>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub open>
            <DropdownMenuSubTrigger>Mais opções</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>Submenu</DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    selectors: ['[data-slot="dropdown-menu-sub-content"]', '[role="presentation"].isolate[data-side]:has([data-slot="dropdown-menu-sub-content"])'],
  },
  {
    name: "tooltip",
    element: () => (
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger render={<button type="button">Dica</button>} />
          <TooltipContent>Texto de ajuda</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
    selectors: ['[data-slot="tooltip-content"]', '[role="presentation"].isolate[data-side]'],
  },
  {
    name: "command",
    element: () => <CommandDialog open><p>Comando</p></CommandDialog>,
    selectors: ['[data-slot="dialog-popup"]', '[data-slot="dialog-overlay"]'],
  },
  {
    name: "combobox",
    element: () => <AppCombobox aria-label="Plano" options={[{ value: "a", label: "Plano A" }]} />,
    selectors: ['[data-slot="popover-content"]', '[role="presentation"].isolate[data-side]'],
    open: () => fireEvent.click(screen.getByRole("combobox", { name: "Plano" })),
  },
  {
    name: "motion Select",
    element: () => (
      <Select>
        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent><SelectItem value="a">Opção A</SelectItem></SelectContent>
      </Select>
    ),
    selectors: ['[role="listbox"]'],
    open: () => fireEvent.click(screen.getByRole("button", { name: "Selecione" })),
  },
  {
    name: "motion AttachmentUpload",
    element: () => <AttachmentUpload defaultValue={[{ id: "img", name: "foto.png", kind: "image", href: "data:image/png;base64,AA==" }]} />,
    selectors: ['[role="dialog"][aria-label="Visualização de foto.png"]', 'button[aria-label="Fechar pré-visualização de imagem"]'],
    open: () => fireEvent.click(screen.getByRole("button", { name: "Visualizar foto.png" })),
  },
  {
    name: "motion SuccessOverlay",
    element: () => <SuccessOverlayHarness />,
    selectors: ['[aria-live="polite"]'],
    open: () => fireEvent.click(screen.getByRole("button", { name: "Celebrar" })),
  },
  {
    name: "Arc BottomSheet",
    element: () => <BottomSheet open title="Ajuda"><p>Conteúdo do sheet</p></BottomSheet>,
    selectors: ['[role="dialog"]', '[class*="overlay"]'],
  },
];

function addDirectorPortalRoot() {
  const root = document.createElement("div");
  root.id = DIRECTOR_LITE_PORTAL_ROOT_ID;
  document.body.append(root);
}

async function verifyRenderedScope(testCase: RenderCase, enabled: boolean) {
  cleanup();
  const wrapper = render(<ArcScopeProvider enabled={enabled}>{testCase.element()}</ArcScopeProvider>);
  testCase.open?.();

  const rendered = await waitFor(() => {
    const elements = testCase.selectors.map((selector) => document.querySelector(selector));
    expect(elements.every(Boolean)).toBe(true);
    return elements as HTMLElement[];
  });

  for (const element of rendered) {
    if (enabled) {
      expect(element).toHaveAttribute("data-skin", "diretor");
      expect(element).toHaveClass("arc-venancor");
    } else {
      expect(element).not.toHaveAttribute("data-skin");
      expect(element).not.toHaveClass("arc-venancor");
    }
  }
  wrapper.unmount();
}

describe("escopo Arc do Diretor", () => {
  it("não adiciona classe ou skin quando o provider está desligado", () => {
    expect(getArcScopeProps(false)).toEqual({});
  });

  it("expõe classe, skin e raiz isolada para o piloto ativo", () => {
    expect(getArcScopeProps(true)).toEqual({ className: "arc-venancor", "data-skin": "diretor" });
    expect(DIRECTOR_LITE_PORTAL_ROOT_ID).toBe("director-lite-portal-root");
  });

  it.each(cases)("aplica o escopo em $name com provider ativo", async (testCase) => {
    addDirectorPortalRoot();
    await verifyRenderedScope(testCase, true);
  });

  it.each(cases)("não aplica o escopo em $name sem provider", async (testCase) => {
    await verifyRenderedScope(testCase, false);
  });

  it("renderiza o BottomSheet no portal Arc isolado quando o provider está ativo", async () => {
    addDirectorPortalRoot();
    render(<ArcScopeProvider enabled><BottomSheet open title="Ajuda"><p>Conteúdo do sheet</p></BottomSheet></ArcScopeProvider>);
    await screen.findByText("Conteúdo do sheet");
    const root = document.getElementById(DIRECTOR_LITE_PORTAL_ROOT_ID);
    expect(root?.querySelector("[data-skin='diretor'].arc-venancor")).toBeTruthy();
  });

  it("mantém o portal do BottomSheet no body quando não há provider", async () => {
    render(<BottomSheet open title="Ajuda"><p>Conteúdo do sheet</p></BottomSheet>);
    await screen.findByText("Conteúdo do sheet");
    expect(document.body.querySelector("[data-skin='diretor']")).toBeNull();
  });
});
