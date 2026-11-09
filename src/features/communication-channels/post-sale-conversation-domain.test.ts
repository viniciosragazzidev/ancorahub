import { describe, expect, it } from "vitest";

import { POST_SALE_META_TEMPLATE } from "@/features/post-sale-audit/template-contract";
import {
  preferPostSaleProviderStatus,
  resolvePostSaleConversationBody,
  shouldRecoverInitialQualificationAfterOutboundFailure,
} from "./post-sale-conversation-domain";

describe("post-sale conversation message domain", () => {
  it("keeps the exact free-text body sent through WAHA or Meta", () => {
    expect(resolvePostSaleConversationBody({
      renderedBody: " Olá, Ana! Posso te fazer duas perguntas? ",
      templateName: "__text__",
      variables: [],
    })).toBe("Olá, Ana! Posso te fazer duas perguntas?");
  });

  it("renders the approved Meta presentation template with its three variables", () => {
    const body = resolvePostSaleConversationBody({
      renderedBody: null,
      templateName: POST_SALE_META_TEMPLATE.name,
      variables: ["Neide", "Âncora Saúde", "Alan"],
    });

    expect(body).toContain("Olá, Neide!");
    expect(body).toContain("equipe de qualidade da Âncora Saúde");
    expect(body).toContain("corretor Alan ficou responsável");
    expect(body).not.toContain("{{");
  });

  it("does not invent message text for an unknown template or incomplete variables", () => {
    expect(resolvePostSaleConversationBody({ renderedBody: null, templateName: "other_template", variables: ["Ana"] })).toBeNull();
    expect(resolvePostSaleConversationBody({ renderedBody: null, templateName: POST_SALE_META_TEMPLATE.name, variables: ["Ana"] })).toBeNull();
  });

  it("does not let a late sent receipt replace delivered, read, or failed", () => {
    expect(preferPostSaleProviderStatus("delivered", "sent")).toBe("delivered");
    expect(preferPostSaleProviderStatus("read", "sent")).toBe("read");
    expect(preferPostSaleProviderStatus("failed", "read")).toBe("failed");
    expect(preferPostSaleProviderStatus("sent", "read")).toBe("read");
  });

  it("does not route a failed post-sale delivery into initial qualification recovery", () => {
    expect(shouldRecoverInitialQualificationAfterOutboundFailure("postSaleSurvey")).toBe(false);
    expect(shouldRecoverInitialQualificationAfterOutboundFailure("qualificationInitial")).toBe(true);
  });
});
