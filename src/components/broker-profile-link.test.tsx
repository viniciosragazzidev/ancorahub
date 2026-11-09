import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BrokerProfileLink, BrokerProfileViewerProvider, canOpenBrokerProfile } from "./broker-profile-link";

describe("BrokerProfileLink", () => {
  it("vira link para o perfil quando diretor, gestor ou supervisor vê", () => {
    for (const role of ["director", "manager", "supervisor"]) {
      const html = renderToStaticMarkup(<BrokerProfileLink brokerId="u-1" name="Ana Souza" viewerRole={role} />);
      expect(html).toContain('href="/equipe/u-1"');
      expect(html).toContain('aria-label="Ver perfil de Ana Souza"');
    }
  });

  it("fica texto puro para corretor, sem id ou no contato sem dono de /conversas", () => {
    expect(renderToStaticMarkup(<BrokerProfileLink brokerId="u-1" name="Ana" viewerRole="broker" />)).toBe("Ana");
    expect(renderToStaticMarkup(<BrokerProfileLink brokerId={null} name="Ana" viewerRole="director" />)).toBe("Ana");
    expect(canOpenBrokerProfile("director", "00000000-0000-0000-0000-000000000000")).toBe(false);
  });

  it("usa o papel do provider quando a prop não vem", () => {
    const html = renderToStaticMarkup(<BrokerProfileViewerProvider viewerRole="manager"><BrokerProfileLink brokerId="u-2" name="Bia" /></BrokerProfileViewerProvider>);
    expect(html).toContain('href="/equipe/u-2"');
  });
});
