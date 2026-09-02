import { afterEach, describe, expect, it } from "vitest";
import { contextProviderRegistry } from "./registry";
import { MockScreenProvider } from "./providers/mock-screen-provider";

describe("ContextProviderRegistry", () => {
  afterEach(() => {
    contextProviderRegistry.list().forEach((p) => contextProviderRegistry.unregister(p.id));
  });

  it("captures nothing when no providers are registered", async () => {
    const snapshots = await contextProviderRegistry.captureAll();
    expect(snapshots).toEqual([]);
  });

  it("captures a snapshot from a registered provider", async () => {
    const provider = new MockScreenProvider("IDE");
    provider.setSnapshot("function foo() {}", "App.tsx");
    contextProviderRegistry.register(provider);

    const snapshots = await contextProviderRegistry.captureAll();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].kind).toBe("IDE");
    expect(snapshots[0].content).toContain("function foo");
  });

  it("skips providers that have nothing to capture", async () => {
    const empty = new MockScreenProvider("SCREEN");
    const populated = new MockScreenProvider("BROWSER");
    populated.setSnapshot("<html>...</html>", "localhost:3000");
    contextProviderRegistry.register(empty);
    contextProviderRegistry.register(populated);

    const snapshots = await contextProviderRegistry.captureAll();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].kind).toBe("BROWSER");
  });

  it("does not let one provider's failure block the others", async () => {
    const failing: import("./types").ContextProvider = {
      id: "failing",
      kind: "TERMINAL",
      capture: async () => {
        throw new Error("capture failed");
      },
    };
    const working = new MockScreenProvider("IDE");
    working.setSnapshot("ok", "file.ts");
    contextProviderRegistry.register(failing);
    contextProviderRegistry.register(working);

    const snapshots = await contextProviderRegistry.captureAll();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].kind).toBe("IDE");
  });
});
