// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InterfaceMotionProvider } from "./interface-motion-provider";
import { FileUpload } from "./file-upload";
import { AttachmentUpload } from "./attachment-upload";

// Exercise final visual states; the repository-wide mock only renders tags.
vi.unmock("motion/react");

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.interfaceMotion;
});

describe("static upload feedback", () => {
  it("keeps progress accurate and removal actionable with motion disabled", () => {
    const remove = vi.fn();
    render(
      <InterfaceMotionProvider enabled={false}>
        <FileUpload
          defaultValue={[
            { id: "synthetic", name: "exemplo.pdf", size: 1024, status: "uploading", progress: 42 },
          ]}
          onRemove={remove}
        />
      </InterfaceMotionProvider>,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByRole("listitem").style.transform).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Remover exemplo.pdf" }));
    expect(remove).toHaveBeenCalledOnce();
    expect(screen.queryByText("exemplo.pdf")).not.toBeInTheDocument();
  });

  it("shows an attachment completion immediately without an entrance transform", () => {
    render(
      <InterfaceMotionProvider enabled={false}>
        <AttachmentUpload
          value={[{ id: "synthetic", name: "exemplo.txt", kind: "file", status: "complete" }]}
        />
      </InterfaceMotionProvider>,
    );
    expect(screen.getByRole("listitem").style.transform).toBe("");
    expect(screen.getByRole("status", { name: "Upload concluído para exemplo.txt" })).toHaveStyle({
      opacity: "1",
    });
  });
});
