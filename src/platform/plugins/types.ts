import type { ComponentType, ReactNode } from "react";

import type { PermissionKey } from "@/shared/auth/permissions";
import type { TenantRole } from "@/shared/db/schema";

export const pluginOpenModes = ["page", "drawer", "dialog", "panel", "widget"] as const;
export type PluginOpenMode = (typeof pluginOpenModes)[number];

export const pluginHosts = ["page", "workspace", "drawer", "dialog", "panel", "widget"] as const;
export type PluginHostName = (typeof pluginHosts)[number];

export const pluginCategories = ["lead", "sales", "finance", "operations", "admin", "intelligence"] as const;
export type PluginCategory = (typeof pluginCategories)[number];

export type PluginContext = {
  tenantId: string;
  userId: string;
  role: TenantRole;
  jobTitle: string | null;
  branchId: string | null;
  entityId?: string;
};

export type PluginManifest = {
  id: string;
  name: string;
  description?: string;
  category: PluginCategory;
  icon: string;
  requiredPermissions: readonly PermissionKey[];
  featureFlag: string;
  minSize: { width: number; height: number };
  preferredSize: { width: number; height: number };
  allowedHosts: readonly PluginHostName[];
  eventsPublished: readonly string[];
  eventsConsumed: readonly string[];
};

export type PluginRuntime = {
  enabledFlags: ReadonlySet<string>;
};

export type PluginRenderProps = {
  context: PluginContext;
  close?: () => void;
};

export type PluginLifecycleEvent =
  | { type: "registered"; pluginId: string }
  | { type: "activated"; pluginId: string; host: PluginHostName }
  | { type: "deactivated"; pluginId: string; reason: string }
  | { type: "failed"; pluginId: string; error: unknown };

export type PluginDefinition = {
  manifest: PluginManifest;
  isReady: boolean;
  isAllowed: (context: PluginContext) => boolean;
  component?: ComponentType<PluginRenderProps>;
  icon?: ReactNode;
};
