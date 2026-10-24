// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { styleChunkRendered } = vi.hoisted(() => ({ styleChunkRendered: vi.fn() }));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>) => function DynamicStyleChunk() {
    styleChunkRendered();
    void loader();
    return null;
  },
}));

vi.mock("./director-lite-styles", () => ({ DirectorLiteStyles: () => null }));

import { DirectorLiteStyleGate } from "./director-lite-style-gate";

afterEach(() => {
  cleanup();
  styleChunkRendered.mockClear();
});

describe("DirectorLiteStyleGate", () => {
  it("não carrega a folha Arc quando a flag está desligada", () => {
    render(<DirectorLiteStyleGate enabled={false} />);

    expect(styleChunkRendered).not.toHaveBeenCalled();
  });

  it("carrega a folha Arc quando a flag do Diretor está ligada", () => {
    render(<DirectorLiteStyleGate enabled />);

    expect(styleChunkRendered).toHaveBeenCalledOnce();
  });
});
