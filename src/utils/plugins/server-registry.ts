import "server-only";

import { createPluginRegistry } from "@/platform/plugins/registry";
import { leadAssignedNotificationPlugin } from "./lead-assigned-notification";

/** Registry used by server-side events, jobs and actions. */
export const serverPluginRegistry = createPluginRegistry([leadAssignedNotificationPlugin]);

