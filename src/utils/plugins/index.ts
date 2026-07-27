export { createPluginRegistry } from "@/platform/plugins/registry";
export { canActivatePlugin } from "@/platform/plugins/guards";
export type { PluginDefinition, PluginContext, PluginRuntime } from "@/platform/plugins/types";
export type { PluginChannel, PluginExecutionResult, ServerPluginDefinition } from "./contracts";
export {
  executeLeadAssignedNotification,
  leadAssignedNotificationPlugin,
  LEAD_ASSIGNED_NOTIFICATION_FEATURE_FLAG,
  LEAD_ASSIGNED_NOTIFICATION_PLUGIN_ID,
} from "./lead-assigned-notification";
export { triggerLeadAssignedNotificationAction } from "./actions";
export { serverPluginRegistry } from "./server-registry";
