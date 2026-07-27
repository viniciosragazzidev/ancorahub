import { canActivatePlugin } from "./guards";
import { createPluginLifecycle } from "./lifecycle";
import type { PluginContext, PluginDefinition, PluginHostName, PluginRuntime } from "./types";

function assertManifest(plugin: PluginDefinition) {
  if (!plugin.manifest.id.trim()) throw new Error("Plugin id cannot be empty.");
  if (!plugin.manifest.featureFlag.trim()) throw new Error(`Plugin ${plugin.manifest.id} must declare a feature flag.`);
}

export function createPluginRegistry(plugins: readonly PluginDefinition[] = []) {
  const definitions = new Map<string, PluginDefinition>();
  const lifecycle = createPluginLifecycle();

  function register(plugin: PluginDefinition) {
    assertManifest(plugin);
    if (definitions.has(plugin.manifest.id)) throw new Error(`Plugin ${plugin.manifest.id} is already registered.`);
    definitions.set(plugin.manifest.id, plugin);
    lifecycle.emit({ type: "registered", pluginId: plugin.manifest.id });
  }

  for (const plugin of plugins) register(plugin);

  return {
    lifecycle,
    register,
    get(pluginId: string) {
      return definitions.get(pluginId);
    },
    list() {
      return [...definitions.values()];
    },
    available(context: PluginContext, host: PluginHostName, runtime: PluginRuntime) {
      return [...definitions.values()]
        .filter((plugin) => canActivatePlugin(plugin, context, host, runtime))
        .sort((first, second) => first.manifest.id.localeCompare(second.manifest.id));
    },
  };
}

export type PluginRegistry = ReturnType<typeof createPluginRegistry>;
