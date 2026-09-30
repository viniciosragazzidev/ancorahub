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

/**
 * "Manual" mode is the queue with no destination: its leads arrive and wait
 * in the queue, without a broker, until the destination is changed.
 */
export function assignmentLabel(queue: Queue) {
  if (queue.assignmentMode !== "automatic") return "Sem destino · leads aguardam na fila";
  return `Automática · ${queue.assignmentStrategy === "round_robin" ? "Round robin" : "Menor carga"}`;
}
