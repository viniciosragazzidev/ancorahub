export type PushAvailability = "unsupported" | "blocked" | "missing_configuration" | "ready";

export type PushAvailabilityInput = {
  hasNotificationApi: boolean;
  hasPushManager: boolean;
  hasServiceWorker: boolean;
  permission: NotificationPermission | "unsupported";
  hasVapidPublicKey: boolean;
};

export function getPushAvailability(input: PushAvailabilityInput): PushAvailability {
  if (!input.hasNotificationApi || !input.hasPushManager || !input.hasServiceWorker) {
    return "unsupported";
  }

  if (input.permission === "denied") {
    return "blocked";
  }

  return input.hasVapidPublicKey ? "ready" : "missing_configuration";
}
