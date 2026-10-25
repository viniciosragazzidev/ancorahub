import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { integrationCatalogEntries } from "./integrations-catalog";
import { IntegrationsCatalogLite } from "./integrations-catalog-lite";

describe("catálogo de integrações Lite", () => {
  it("mostra os mesmos itens e destinos, e os planejados sem link", () => {
    const html = renderToStaticMarkup(<IntegrationsCatalogLite />);
    for (const entry of integrationCatalogEntries) {
      expect(html).toContain(entry.name);
      if (entry.href) expect(html).toContain(`href="${entry.href}"`);
    }
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(integrationCatalogEntries.filter((entry) => !entry.href).length);
  });
});
