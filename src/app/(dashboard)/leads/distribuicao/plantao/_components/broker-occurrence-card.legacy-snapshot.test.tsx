// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/lead-distribution/duty-actions", () => ({
  assignDutyLeadToBrokerAction: vi.fn(),
  getBrokerDayHistoryAction: vi.fn(),
  getBrokerOccurrenceLeadsAction: vi.fn(),
  getDutyAvailableLeadsAction: vi.fn(),
  setDutyAbsenceAction: vi.fn(),
  setDutyAssignmentAttendanceModeAction: vi.fn(),
}));
vi.mock("./broker-presence-release-button", () => ({ BrokerPresenceReleaseButton: () => null }));
vi.mock("./broker-day-history-trigger", () => ({ BrokerDayHistoryTrigger: () => null }));
vi.mock("./broker-pause-button", () => ({ BrokerPauseButton: () => null }));
vi.mock("./broker-presence-invite-button", () => ({ BrokerPresenceInviteButton: () => null }));
vi.mock("./broker-live-status", () => ({ BrokerCapacityBar: () => null, BrokerLiveStatus: () => null }));
vi.mock("./duty-swap-picker", () => ({ DutySwapDoneNotice: () => null, DutySwapPicker: () => null }));
vi.mock("@/components/foundations/detail-drawer", () => ({ DetailDrawer: () => null }));
vi.mock("@/components/status-badges", () => ({ LeadStatusBadge: () => null }));

import { Badge } from "@/components/ui/badge";
import { BrokerCapacityBar, BrokerLiveStatus } from "./broker-live-status";
import { BrokerOccurrenceCard } from "./broker-occurrence-card";

describe("BrokerOccurrenceCard: HTML de origem sem a chave Lite", () => {
  it("mantém a estrutura de d2d80a01 quando recebe os children legados", () => {
    const html = renderToStaticMarkup(
      <BrokerOccurrenceCard
        scheduleId="schedule-1"
        assignmentId="assignment-1"
        brokerId="broker-1"
        brokerName="Mariana de Albuquerque Costa e Silva"
        directorLite={false}
        phone="21999990000"
        presenceStatus="confirmed"
        paused={false}
        confirmedAt="2026-10-25T16:00:00.000Z"
        absent={false}
        attendanceMode="online"
        scheduleAttendanceMode="online"
        onSitePending={false}
        branchName="Unidade Centro"
        canAssignLeads
        summary={{
          internalCode: "A-317",
          availabilityStatus: "Disponível",
          presenceEnabled: true,
          releasedByName: null,
          onlineOverride: false,
          notificationErrorCode: null,
          liveStatus: "ready",
          nextEventAt: null,
          activeLeads: 3,
          capacity: 5,
          crossesCut: true,
          leadsMorning: 1,
          leadsAfternoon: 2,
        }}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">Mariana de Albuquerque Costa e Silva</span>
            <Badge variant="info" title="Troca de turno confirmada">Troca feita</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Código A-317 · Unidade Centro · Disponível</p>
          <div className="mt-1.5"><BrokerLiveStatus status="ready" nextEventAt={null} /></div>
          <BrokerCapacityBar activeLeads={3} capacity={5} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5" aria-label="1 leads de manhã e 2 à tarde neste plantão">
          <Badge variant="info" title="Leads recebidos de manhã neste plantão">Manhã 1</Badge>
          <Badge variant="destructive" title="Leads recebidos à tarde neste plantão">Tarde 2</Badge>
        </div>
      </BrokerOccurrenceCard>,
    );

    expect(html).toMatchSnapshot("HTML legado de d2d80a01");
  });
});
