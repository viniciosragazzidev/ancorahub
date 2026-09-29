export type Queue = {
  id: string;
  name: string;
  branchId: string | null;
  exclusiveDutyScheduleId?: string | null;
  exclusiveDutyScheduleIds?: string[] | null;
  dutyFallbackPolicy?: string | null;
  dutyFallbackQueueId?: string | null;
  branchName?: string | null;
  status: string;
  assignmentMode: string;
  assignmentStrategy: string;
  capacityEnabled: boolean;
  capacityPerBroker: number | null;
  offerIntervalMinutes?: number;
  maxPendingOffersPerBroker?: number;
  aiQualificationEnabled?: boolean;
  attendanceFlowId?: string | null;
  colorHue?: number | null;
  waiting: number;
  members: number;
  activeLeads: number;
  allowedBranchIds?: string[];
  allowedBrokerIds?: string[];
  allowedSourceIds?: string[];
};

export type DutySchedule = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  dayOfWeek?: number;
  branchName?: string | null;
};

/** Duty schedules a queue is exclusive to (legacy single id + the list). */
export function queueDutyScheduleIds(queue: Queue) {
  return Array.from(new Set([
    ...(queue.exclusiveDutyScheduleIds ?? []),
    ...(queue.exclusiveDutyScheduleId ? [queue.exclusiveDutyScheduleId] : []),
  ]));
}

export function assignmentLabel(queue: Queue) {
  return `${queue.assignmentMode === "automatic" ? "Automática" : "Manual"} · ${queue.assignmentStrategy === "round_robin" ? "Round robin" : "Menor carga"}`;
}
