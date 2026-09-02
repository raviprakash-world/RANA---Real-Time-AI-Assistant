import { ContextProvider, ContextSnapshot, ContextSourceKind } from "../types";

/**
 * Reference implementation of `ContextProvider`, standing in for a real
 * screen/IDE/browser capture integration. Not registered in production —
 * exists to prove the interface is implementable and to exercise
 * `ContextProviderRegistry` in tests, exactly like `MockLLMProvider` stands
 * in for a real LLM provider.
 */
export class MockScreenProvider implements ContextProvider {
  readonly id: string;
  readonly kind: ContextSourceKind;
  private snapshot: ContextSnapshot | null;

  constructor(kind: ContextSourceKind = "SCREEN", initialSnapshot: ContextSnapshot | null = null) {
    this.id = `mock-${kind.toLowerCase()}`;
    this.kind = kind;
    this.snapshot = initialSnapshot;
  }

  setSnapshot(content: string, label = "Mock capture"): void {
    this.snapshot = { kind: this.kind, label, content, capturedAt: new Date() };
  }

  async capture(): Promise<ContextSnapshot | null> {
    return this.snapshot;
  }
}
