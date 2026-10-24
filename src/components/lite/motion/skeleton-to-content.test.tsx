// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

import { LiteSkeletonToContent } from "./skeleton-to-content";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteSkeletonToContent", () => {
  it("shows the skeleton while loading", () => {
    render(
      <LiteSkeletonToContent loading skeleton={<p>Carregando lista</p>}>
        <p>Lista pronta</p>
      </LiteSkeletonToContent>,
    );
    expect(screen.getByText("Carregando lista")).toBeInTheDocument();
    expect(screen.queryByText("Lista pronta")).not.toBeInTheDocument();
  });

  it("shows the content once loaded and reserves the minimum height", () => {
    const { container } = render(
      <LiteSkeletonToContent loading={false} skeleton={<p>Carregando lista</p>} minHeight={320}>
        <p>Lista pronta</p>
      </LiteSkeletonToContent>,
    );
    expect(screen.getByText("Lista pronta")).toBeInTheDocument();
    expect((container.firstElementChild as HTMLElement).style.minHeight).toBe("320px");
  });

  it("renders the loaded content with reduced motion", () => {
    motionState.reduce = true;
    render(
      <LiteSkeletonToContent loading={false} skeleton={<p>Carregando lista</p>}>
        <p>Lista pronta</p>
      </LiteSkeletonToContent>,
    );
    expect(screen.getByText("Lista pronta")).toBeInTheDocument();
  });
});
