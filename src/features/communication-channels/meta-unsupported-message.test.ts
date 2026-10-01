import { describe, expect, it } from "vitest";

import { describeUnsupportedMessage } from "./meta-unsupported-message";

describe("a message Meta delivers as unsupported", () => {
  it("shows Meta's error, the kind and the ad it came from", () => {
    const described = describeUnsupportedMessage({
      errors: [{ code: 131051, title: "Message type unknown", error_data: { details: "Message type is currently not supported." } }],
      unsupported: { type: "unknown" },
      referral: { source_type: "ad", headline: "Carência Zero" },
    });
    expect(described.text).toBe("⚠️ O cliente mandou uma mensagem que a Meta não entrega pelo sistema (erro 131051 · Message type unknown: Message type is currently not supported. · tipo unknown · veio de anúncio \"Carência Zero\"). Veja o conteúdo no celular do número.");
    expect(described.errorCode).toBe("unsupported:131051");
  });

  it("still describes a message with no details", () => {
    expect(describeUnsupportedMessage({})).toEqual({
      text: "⚠️ O cliente mandou uma mensagem que a Meta não entrega pelo sistema. Veja o conteúdo no celular do número.",
      errorCode: "unsupported",
    });
  });
});
