import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BrokerProfileLink, BrokerProfileViewerProvider, canOpenBrokerProfile } from "./broker-profile-link";

describe("BrokerProfileLink", () => {
  it("vira link para o perfil quando diretor ou gestor vê", () => {
    for (const role of ["director", "manager"]) {
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

  describe("supervisor", () => {
    it("só vê link para corretor da equipe dele", () => {
      const html = renderToStaticMarkup(
        <BrokerProfileViewerProvider viewerRole="supervisor" teamBrokerIds={["u-1"]}>
          <BrokerProfileLink brokerId="u-1" name="Ana" />|<BrokerProfileLink brokerId="u-9" name="Caio" />
        </BrokerProfileViewerProvider>,
      );
      expect(html).toContain('href="/equipe/u-1"');
      expect(html).not.toContain("/equipe/u-9");
      expect(html).toContain("|Caio");
    });

    it("sem a lista da equipe, nada vira link", () => {
      expect(renderToStaticMarkup(<BrokerProfileLink brokerId="u-1" name="Ana" viewerRole="supervisor" />)).toBe("Ana");
      expect(canOpenBrokerProfile("supervisor", "u-1")).toBe(false);
      expect(canOpenBrokerProfile("supervisor", "u-1", [])).toBe(false);
      expect(canOpenBrokerProfile("supervisor", "u-1", new Set(["u-1"]))).toBe(true);
    });

    it("provider interno herda a equipe do provider de fora (layout) e a prop de papel não fura o escopo", () => {
      const html = renderToStaticMarkup(
        <BrokerProfileViewerProvider viewerRole="supervisor" teamBrokerIds={["u-1"]}>
          <BrokerProfileViewerProvider viewerRole="supervisor">
            <BrokerProfileLink brokerId="u-1" name="Ana" />|<BrokerProfileLink brokerId="u-2" name="Bia" viewerRole="supervisor" />
          </BrokerProfileViewerProvider>
        </BrokerProfileViewerProvider>,
      );
      expect(html).toContain('href="/equipe/u-1"');
      expect(html).not.toContain("/equipe/u-2");
    });

    it("gestor e diretor ignoram a lista de equipe", () => {
      expect(canOpenBrokerProfile("manager", "u-9", ["u-1"])).toBe(true);
      expect(canOpenBrokerProfile("director", "u-9", [])).toBe(true);
    });
  });
});
