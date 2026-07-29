// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LeadStatusBadge } from "./status-badges";

afterEach(cleanup);

describe("LeadStatusBadge", () => {
  it.each([
    ["IN_CONTACT", "Em atendimento"],
    ["CONVERTED", "Convertido"],
  ])("shows a localized label for the persisted status %s", (status, label) => {
    render(<LeadStatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(status)).not.toBeInTheDocument();
  });
});
