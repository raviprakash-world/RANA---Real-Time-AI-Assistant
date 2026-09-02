import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { apiError, badRequest } from "@/lib/http/api-error";
import { checkRateLimit } from "@/lib/http/rate-limit";

const MAX_TEXT_CHARS = 20000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

/**
 * Server-side text extraction for the Resume / Job Description upload on
 * /sessions/new (.txt/.md are simple enough to read client-side with
 * file.text(), but PDF and Word need a real parser — pdf-parse and mammoth
 * are both Node-only, so this has to be a round trip rather than something
 * done in the browser).
 */
export async function POST(req: NextRequest) {
  if (!checkRateLimit("parse-file", 20, 60_000)) {
    return apiError(429, "Too many file uploads — please wait a moment.");
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return badRequest("No file provided");
  }
  if (file.size > MAX_FILE_BYTES) {
    return badRequest("File is too large (max 15MB)");
  }

  const ext = file.name.toLowerCase().split(".").pop();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    let text: string;

    if (ext === "pdf") {
      const parser = new PDFParse({ data: buffer });
      try {
        // Join pages ourselves rather than using result.text — pdf-parse
        // interleaves "-- N of M --" page-separator lines into that field,
        // which would otherwise leak into the extracted resume/JD text.
        const result = await parser.getText();
        text = result.pages.map((p) => p.text).join("\n\n");
      } finally {
        await parser.destroy();
      }
    } else if (ext === "docx") {
      text = (await mammoth.extractRawText({ buffer })).value;
    } else {
      return badRequest("Unsupported file type — use .txt, .md, .pdf, or .docx (.doc is not supported).");
    }

    text = text.trim();
    if (!text) {
      return badRequest("Couldn't find any text in this file — it may be empty, scanned/image-based, or encrypted.");
    }

    return NextResponse.json({ filename: file.name, text: text.slice(0, MAX_TEXT_CHARS) });
  } catch (err) {
    return apiError(500, "Failed to read this file", err);
  }
}
