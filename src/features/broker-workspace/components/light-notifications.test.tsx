// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ read: vi.fn(async () => {}), readAll: vi.fn(async () => {}), more: vi.fn() }));
vi.mock("@/app/(dashboard)/notificacoes/actions", () => ({ markNotificationReadAction: actions.read, markAllNotificationsReadAction: actions.readAll, loadMoreNotificationsAction: actions.more }));
vi.mock("@/features/notifications/components/push-notification-manager", () => ({ PushNotificationManager: () => null }));
vi.mock("./light-lead-toast-toggle", () => ({ LightLeadToastToggle: () => null }));

import { LightNotifications } from "./light-notifications";

afterEach(() => cleanup());

const now = new Date().toISOString();
const items = [
  { id: "n1", title: "Você vê isso?", message: "Se sim confirme!", type: "relationship.confirmation", readAt: null, createdAt: now, leadId: null },
  { id: "n2", title: "Lead qualificado atribuído", message: "Você recebeu o lead Bruna.", type: "agent.lead_assigned", readAt: now, createdAt: now, leadId: "l1" },
];

describe("LightNotifications", () => {
  it("shows the unread count, a category per notice and opens the lead from the row", () => {
    render(<LightNotifications initialNotifications={items} initialNextCursor={null} initialHasMore={false} totalCount={2} unreadCount={1} urgentCount={0} leadToastEnabled />);
    expect(screen.getByText("aviso novo")).toBeTruthy();
    expect(screen.getByText("Gestão")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Lead qualificado atribuído/ }).getAttribute("href")).toBe("/leads/l1");
  });

  it("tapping an unread notice without a lead marks it read", () => {
    render(<LightNotifications initialNotifications={items} initialNextCursor={null} initialHasMore={false} totalCount={2} unreadCount={1} urgentCount={0} leadToastEnabled />);
    fireEvent.click(screen.getByRole("button", { name: /Você vê isso\?.*Toque para marcar como lida/ }));
    expect(actions.read).toHaveBeenCalled();
  });
});
