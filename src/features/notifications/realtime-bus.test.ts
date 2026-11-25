import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getListenDatabaseUrl } from "@/shared/db/client";

import { parseRealtimeMessage } from "./realtime-bus";

describe("parseRealtimeMessage", () => {
  it("lê tópico e aviso do pg_notify", () => {
    expect(parseRealtimeMessage(JSON.stringify({ t: "ancorahub:sync:abc", s: { kind: "domain.invalidated", domain: "leads" } }))).toEqual({
      topic: "ancorahub:sync:abc",
      signal: { kind: "domain.invalidated", domain: "leads" },
    });
  });

  it("ignora mensagem fora do formato", () => {
    expect(parseRealtimeMessage("not json")).toBeNull();
    expect(parseRealtimeMessage(JSON.stringify({ s: {} }))).toBeNull();
    expect(parseRealtimeMessage(JSON.stringify({ t: "x" }))).toBeNull();
  });
});

describe("getListenDatabaseUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("troca o modo transação do pooler (6543) pelo modo sessão (5432), que mantém LISTEN", () => {
    vi.stubEnv("REALTIME_DATABASE_URL", "");
    vi.stubEnv("SUPABASE_DB_URL", "");
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@aws-1-sa-east-1.pooler.supabase.com:6543/postgres");
    expect(getListenDatabaseUrl()).toBe("postgresql://u:p@aws-1-sa-east-1.pooler.supabase.com:5432/postgres");
  });

  it("usa a URL direta do banco próprio sem mudar nada", () => {
    vi.stubEnv("REALTIME_DATABASE_URL", "");
    vi.stubEnv("SUPABASE_DB_URL", "");
    vi.stubEnv("DATABASE_URL", "postgres://app:secret@ancorahub-db:5432/ancorahub");
    expect(getListenDatabaseUrl()).toBe("postgres://app:secret@ancorahub-db:5432/ancorahub");
  });

  it("REALTIME_DATABASE_URL vence", () => {
    vi.stubEnv("REALTIME_DATABASE_URL", "postgres://listen@host:5432/db");
    expect(getListenDatabaseUrl()).toBe("postgres://listen@host:5432/db");
  });
});
