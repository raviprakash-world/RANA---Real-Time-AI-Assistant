import { NextResponse } from "next/server";
import { getLLMProvider } from "@/lib/ai/llm";

export async function GET() {
  const provider = getLLMProvider();
  return NextResponse.json({
    llmProvider: provider.id,
    isMock: provider.isMock,
  });
}
