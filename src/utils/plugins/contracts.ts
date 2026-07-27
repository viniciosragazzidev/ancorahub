import type { PluginDefinition } from "@/platform/plugins/types";

export const pluginChannels = ["push", "whatsapp"] as const;
export type PluginChannel = (typeof pluginChannels)[number];

export type PluginExecutionResult = {
  pluginId: string;
  executed: boolean;
  duplicate?: boolean;
  channels: PluginChannel[];
  warnings: string[];
};

export type ServerPluginDefinition<TInput> = PluginDefinition & {
  execute: (input: TInput) => Promise<PluginExecutionResult>;
};
