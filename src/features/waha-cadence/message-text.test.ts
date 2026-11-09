import { describe, expect, it } from "vitest";

import { extractWahaMessageText } from "./message-text";

describe("extractWahaMessageText", () => {
  it("reads the top-level body, and the caption when the body is an empty string", () => {
    expect(extractWahaMessageText({ body: "Oi" })).toBe("Oi");
    expect(extractWahaMessageText({ body: "", caption: "Segue a foto" })).toBe("Segue a foto");
  });

  it("reads WEBJS text from _data.body, but never the base64 thumbnail of a media message", () => {
    expect(extractWahaMessageText({ body: "", _data: { type: "chat", body: "Quero cotar" } })).toBe("Quero cotar");
    expect(extractWahaMessageText({ body: "", _data: { type: "image", body: "/9j/4AAQSkZJRgABAQ", caption: "Carteirinha" } })).toBe("Carteirinha");
    expect(extractWahaMessageText({ body: "", _data: { type: "image", body: "/9j/4AAQSkZJRgABAQ" } })).toBe("");
  });

  it("reads NOWEB proto text (conversation and quoted replies)", () => {
    expect(extractWahaMessageText({ body: null, _data: { message: { conversation: "Bom dia" } } })).toBe("Bom dia");
    expect(extractWahaMessageText({ _data: { message: { extendedTextMessage: { text: "Respondendo", contextInfo: { stanzaId: "X" } } } } })).toBe("Respondendo");
  });

  it("reads GOWS PascalCase _data.Message", () => {
    expect(extractWahaMessageText({ body: "", _data: { Info: { Type: "text" }, Message: { conversation: "Pode ser" } } })).toBe("Pode ser");
    expect(extractWahaMessageText({ _data: { Message: { ExtendedTextMessage: { Text: "Combinado" } } } })).toBe("Combinado");
  });

  it("unwraps disappearing, view-once, document-with-caption and edited envelopes", () => {
    expect(extractWahaMessageText({ _data: { message: { ephemeralMessage: { message: { extendedTextMessage: { text: "Temporária" } } } } } })).toBe("Temporária");
    expect(extractWahaMessageText({ _data: { message: { viewOnceMessageV2: { message: { imageMessage: { caption: "Uma vez" } } } } } })).toBe("Uma vez");
    expect(extractWahaMessageText({ _data: { message: { documentWithCaptionMessage: { message: { documentMessage: { caption: "Contrato" } } } } } })).toBe("Contrato");
    expect(extractWahaMessageText({ _data: { message: { editedMessage: { message: { protocolMessage: { editedMessage: { conversation: "Corrigido" } } } } } } })).toBe("Corrigido");
    expect(extractWahaMessageText({ _data: { message: { protocolMessage: { type: 14, editedMessage: { conversation: "Editado" } } } } })).toBe("Editado");
  });

  it("reads button and list answers", () => {
    expect(extractWahaMessageText({ _data: { message: { buttonsResponseMessage: { selectedDisplayText: "Sim" } } } })).toBe("Sim");
    expect(extractWahaMessageText({ _data: { message: { listResponseMessage: { title: "Plano familiar" } } } })).toBe("Plano familiar");
  });

  it("returns empty when there truly is no text (revoke, reaction, receipt)", () => {
    expect(extractWahaMessageText({ body: "" })).toBe("");
    expect(extractWahaMessageText({ body: "", _data: { message: { protocolMessage: { type: 0, key: { id: "X" } } } } })).toBe("");
    expect(extractWahaMessageText({ body: "", _data: { message: { reactionMessage: { text: "👍" } } } })).toBe("");
    expect(extractWahaMessageText({ ack: 2, ackName: "DEVICE" })).toBe("");
  });
});

describe("miniatura sem tipo", () => {
  it("base64 em _data.body sem _data.type não vira texto", () => {
    const thumb = "/9j/4AAQSkZJRgABAQAAAQABAAD" + "A".repeat(200);
    expect(extractWahaMessageText({ body: "", _data: { body: thumb } })).toBe("");
    expect(extractWahaMessageText({ body: "", _data: { body: "Bom dia, recebi a cotação" } })).toBe("Bom dia, recebi a cotação");
  });
});
