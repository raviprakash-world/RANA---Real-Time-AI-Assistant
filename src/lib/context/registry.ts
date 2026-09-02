import { ContextProvider, ContextSnapshot } from "./types";

/**
 * Holds whatever automated context providers are registered (none, by
 * default) and pulls a snapshot from each. Kept deliberately dumb — no
 * provider-specific logic lives here, so registering a real IDE/browser/
 * screen provider later is a one-line `register()` call, not a rewrite.
 */
class ContextProviderRegistry {
  private providers = new Map<string, ContextProvider>();

  register(provider: ContextProvider): void {
    this.providers.set(provider.id, provider);
  }

  unregister(providerId: string): void {
    this.providers.delete(providerId);
  }

  list(): ContextProvider[] {
    return [...this.providers.values()];
  }

  async captureAll(): Promise<ContextSnapshot[]> {
    const results = await Promise.allSettled([...this.providers.values()].map((p) => p.capture()));
    return results
      .filter((r): r is PromiseFulfilledResult<ContextSnapshot | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((snapshot): snapshot is ContextSnapshot => snapshot !== null);
  }
}

const globalForRegistry = globalThis as unknown as { contextProviderRegistry?: ContextProviderRegistry };
export const contextProviderRegistry = globalForRegistry.contextProviderRegistry ?? new ContextProviderRegistry();
if (process.env.NODE_ENV !== "production") {
  globalForRegistry.contextProviderRegistry = contextProviderRegistry;
}
