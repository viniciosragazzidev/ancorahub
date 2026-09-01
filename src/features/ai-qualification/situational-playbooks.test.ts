import { describe, expect, it } from "vitest";
import {
  getDefaultPlaybooks,
  interpolatePlaybookVariables,
  SituationalPlaybookItemSchema,
} from "./situations-catalog";
import {
  buildSituationalPromptSection,
  matchBestPlaybook,
} from "./situational-response-engine";
import { buildAgentSystemPrompt } from "@/features/ai-agent/tenant-config";
import { situationalPlaybooksDomainRoot } from "@/shared/domain-root/situational-playbooks-root";

describe("Situational Playbooks & Polished AI Responses (Qualificação Centralizada)", () => {
  describe("Situations Catalog & Schemas", () => {
    it("returns default playbooks with 8 essential commercial situations", () => {
      const playbooks = getDefaultPlaybooks();
      expect(playbooks.length).toBe(8);

      const keys = playbooks.map((p) => p.key);
      expect(keys).toContain("ORGANIC_INBOUND_WHATSAPP");
      expect(keys).toContain("META_ADS_LEAD_INTAKE");
      expect(keys).toContain("PRICE_QUOTE_DIRECT_INQUIRY");
      expect(keys).toContain("NETWORK_HOSPITALS_INQUIRY");
      expect(keys).toContain("REENGAGEMENT_SILENCE");
      expect(keys).toContain("HUMAN_HANDOFF_REQUEST");
      expect(keys).toContain("OUT_OF_HOURS_CONTACT");
      expect(keys).toContain("ADAPTIVE_CONTEXTUAL_REPLY");
    });

    it("validates valid situational playbook item", () => {
      const validPlaybook = getDefaultPlaybooks()[0];
      const parsed = SituationalPlaybookItemSchema.safeParse(validPlaybook);
      expect(parsed.success).toBe(true);
    });

    it("interpolates variables correctly in template responses", () => {
      const template = "Olá, {cliente_nome}! Sou a {assistente_nome} da {corretora_nome}. Trabalhamos com {operadoras_principais}.";
      const interpolated = interpolatePlaybookVariables(template, {
        cliente_nome: "Mariana",
        assistente_nome: "Beatriz",
        corretora_nome: "Âncora Seguros",
        operadoras_principais: "Amil e SulAmérica",
      });

      expect(interpolated).toBe("Olá, Mariana! Sou a Beatriz da Âncora Seguros. Trabalhamos com Amil e SulAmérica.");
    });
  });

  describe("Domain Root & Invariants", () => {
    it("Root definition has contract version 1 and safe defaults", () => {
      expect(situationalPlaybooksDomainRoot.key).toBe("situational-playbooks");
      expect(situationalPlaybooksDomainRoot.contractVersion).toBe(1);
      expect(situationalPlaybooksDomainRoot.defaults.enabled).toBe(true);
    });

    it("Invariant ESSENTIAL_SITUATIONS_EXIST verifies required scenarios", () => {
      const validConfig = { ...situationalPlaybooksDomainRoot.defaults };
      const res = situationalPlaybooksDomainRoot.validate(validConfig);
      expect(res.valid).toBe(true);

      const invalidConfig = {
        ...situationalPlaybooksDomainRoot.defaults,
        playbooks: [],
      };
      const invalidRes = situationalPlaybooksDomainRoot.validate(invalidConfig);
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.issues.some((i) => i.includes("ORGANIC_INBOUND_WHATSAPP"))).toBe(true);
    });
  });

  describe("Situational Response Engine", () => {
    it("builds prompt section with polite few-shot guidelines", () => {
      const promptSection = buildSituationalPromptSection({
        variables: {
          assistente_nome: "Ana",
          corretora_nome: "Âncora Corretora",
        },
      });

      expect(promptSection).toContain("DIRETRIZES DE ATENDIMENTO SITUACIONAL & POLIDEZ");
      expect(promptSection).toContain("PRIMEIRO CONTATO DIRETO NO WHATSAPP");
      expect(promptSection).toContain("PERGUNTA DIRETA DE PREÇO / VALORES");
      expect(promptSection).toContain("Ana");
      expect(promptSection).toContain("Âncora Corretora");
    });

    it("matches price inquiry keywords accurately", () => {
      const playbooks = getDefaultPlaybooks();
      const match = matchBestPlaybook("quanto custa a mensalidade da Amil?", playbooks);
      expect(match).not.toBeNull();
      expect(match?.key).toBe("PRICE_QUOTE_DIRECT_INQUIRY");
    });

    it("matches hospital / network inquiry keywords accurately", () => {
      const playbooks = getDefaultPlaybooks();
      const match = matchBestPlaybook("atende no hospital sao luiz em sao paulo?", playbooks);
      expect(match).not.toBeNull();
      expect(match?.key).toBe("NETWORK_HOSPITALS_INQUIRY");
    });

    it("matches human handoff request keywords accurately", () => {
      const playbooks = getDefaultPlaybooks();
      const match = matchBestPlaybook("quero falar com um corretor humano por favor", playbooks);
      expect(match).not.toBeNull();
      expect(match?.key).toBe("HUMAN_HANDOFF_REQUEST");
    });
  });

  describe("System Prompt Integration", () => {
    it("generates system prompt containing humanized greeting principles and situational guidelines", () => {
      const systemPrompt = buildAgentSystemPrompt(
        {
          assistantName: "Juliana",
          tone: "friendly",
          formOfAddress: "voce",
          useEmojis: true,
          language: "pt-BR",
          enabled: true,
          maxQuestions: 6,
        },
        "Corretora Elite"
      );

      expect(systemPrompt).toContain("Juliana");
      expect(systemPrompt).toContain("Corretora Elite");
      expect(systemPrompt).toContain("MODO 1 — ROTEIRO DE QUALIFICAÇÃO");
      expect(systemPrompt).toContain("DIRETRIZES DE ATENDIMENTO SITUACIONAL & POLIDEZ");
    });
  });
});
