import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Architecture Fitness Tests: Domain Root Independence", () => {
  const domainRootDirectory = path.resolve(__dirname);

  function getDomainRootFiles(): string[] {
    const entries = fs.readdirSync(domainRootDirectory, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".tsx")))
      .filter((e) => !e.name.endsWith(".test.ts") && !e.name.endsWith(".test.tsx"))
      .map((e) => path.join(domainRootDirectory, e.name));
  }

  it("Domain Root core modules must not import React or react-dom", () => {
    const files = getDomainRootFiles();
    const forbiddenPatterns = [/from\s+['"]react['"]/, /from\s+['"]react-dom['"]/];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf-8");
      for (const pattern of forbiddenPatterns) {
        const matches = pattern.test(content);
        expect(
          matches,
          `File ${path.basename(filePath)} violates architecture boundary by importing React`,
        ).toBe(false);
      }
    }
  });

  it("Domain Root core modules must not import next/* packages", () => {
    const files = getDomainRootFiles();
    const forbiddenPattern = /from\s+['"]next(\/.*)?['"]/;

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf-8");
      const matches = forbiddenPattern.test(content);
      expect(
        matches,
        `File ${path.basename(filePath)} violates architecture boundary by importing Next.js packages`,
      ).toBe(false);
    }
  });

  it("Domain Root core modules must not import features or dashboard UI", () => {
    const files = getDomainRootFiles();
    const forbiddenPatterns = [
      /from\s+['"]@\/features\/.*['"]/,
      /from\s+['"]@\/app\/.*['"]/,
      /from\s+['"]\.\.\/\.\.\/features\/.*['"]/,
      /from\s+['"]\.\.\/\.\.\/app\/.*['"]/,
    ];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf-8");
      for (const pattern of forbiddenPatterns) {
        const matches = pattern.test(content);
        expect(
          matches,
          `File ${path.basename(filePath)} violates architecture boundary by importing feature or app code`,
        ).toBe(false);
      }
    }
  });

  it("Domain Root core resolver must remain pure and free from DB clients", () => {
    const resolverPath = path.join(domainRootDirectory, "resolver.ts");
    const content = fs.readFileSync(resolverPath, "utf-8");

    const forbiddenPatterns = [
      /from\s+['"]@\/shared\/db.*['"]/,
      /from\s+['"]drizzle-orm.*['"]/,
      /from\s+['"]postgres.*['"]/,
    ];

    for (const pattern of forbiddenPatterns) {
      const matches = pattern.test(content);
      expect(
        matches,
        `resolver.ts violates purity by importing database client`,
      ).toBe(false);
    }
  });
});
