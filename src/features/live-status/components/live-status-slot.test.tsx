import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LiveStatusBoundary, LiveStatusFallback } from "./live-status-slot";

const context = { tenantId: "tenant-a", userId: "director-a", role: "director", jobTitle: "director", branchId: null } as never;

describe("faixa de status dentro da tela Lite", () => {
  it("com a chave desligada não emite HTML", () => {
    const html = renderToStaticMarkup(<LiveStatusBoundary context={context} enabled={false} />);
    expect(html).toMatchInlineSnapshot(`""`);
  });

  it("reserva os cartões do papel enquanto os dados agregados carregam", () => {
    const html = renderToStaticMarkup(<LiveStatusFallback role="director" />);
    expect(html).toContain('data-live-status-fallback=""');
    expect(html.match(/cardSkeleton/g)).toHaveLength(8);
    expect(html).toContain('aria-hidden="true"');
  });
});
