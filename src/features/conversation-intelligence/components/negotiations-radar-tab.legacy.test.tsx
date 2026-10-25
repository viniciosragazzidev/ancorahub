// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NegotiationsRadarTab } from "./negotiations-radar-tab";
import { RADAR_FIXTURES } from "./radar-fixtures";

// Chave desligada (sem provider): o Radar IA segue com o mesmo HTML de antes do Lite. Snapshot do arquivo original.
vi.mock("../actions", () => ({ triggerManualConversationAnalysisAction: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/leads", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

afterEach(cleanup);

describe("Radar IA com a chave desligada", () => {
  it("preserva o HTML legado", () => {
    const { container } = render(
      <NegotiationsRadarTab
        leads={RADAR_FIXTURES}
        branches={[{ id: "branch-centro", name: "Centro" }]}
        brokers={[{ id: "b1", name: "Ana Souza", branchId: "branch-centro" }]}
        contextRole="director"
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
