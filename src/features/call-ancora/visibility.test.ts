import { describe, expect, it } from "vitest";

import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { canUseCallAncora } from "./visibility";

describe("acesso visual do Call Âncora", () => {
  it("mantém a flag global desligada por padrão", () => {
    expect(FEATURE_FLAGS.CALL_ANCORA_VISUAL.defaultValue).toBe("false");
  });

  it("só mostra para corretores quando o Super-admin liga a flag", () => {
    expect(canUseCallAncora({ role: "broker", featureEnabled: false, platformAdmin: false, development: false })).toBe(false);
    expect(canUseCallAncora({ role: "broker", featureEnabled: true, platformAdmin: false, development: false })).toBe(true);
  });

  it("permite a demonstração para admins da plataforma e no ambiente local, mesmo com a flag desligada", () => {
    expect(canUseCallAncora({ role: "director", featureEnabled: false, platformAdmin: true, development: false })).toBe(true);
    expect(canUseCallAncora({ role: "broker", featureEnabled: false, platformAdmin: true, development: false })).toBe(true);
    expect(canUseCallAncora({ role: "manager", featureEnabled: false, platformAdmin: false, development: true })).toBe(true);
  });

  it("com a flag ligada, o diretor abre a tela para configurar", () => {
    expect(canUseCallAncora({ role: "director", featureEnabled: true, platformAdmin: false, development: false })).toBe(true);
    expect(canUseCallAncora({ role: "director", featureEnabled: false, platformAdmin: false, development: false })).toBe(false);
  });

  it("não libera outros papéis em produção só porque a flag foi ligada", () => {
    expect(canUseCallAncora({ role: "manager", featureEnabled: true, platformAdmin: false, development: false })).toBe(false);
  });
});
