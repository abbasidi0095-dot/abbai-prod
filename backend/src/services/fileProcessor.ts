import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { Attachment } from "@prisma/client";
import { getSupabaseAdmin } from "../auth/supabase";
import { appConfig, devMode } from "../config";
import { logger } from "../utils/logger";

export interface ProcessedAttachment {
  id: string;
  filename: string;
  mimeType: string;
  type: "image" | "text" | "pdf" | "docx" | "unsupported";
  base64?: string;
  text?: string;
}

const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const TEXT_MIME_TYPES = ["text/plain", "text/csv", "application/json", "text/markdown", "text/x-markdown"];

function classifyAttachment(mimeType: string): ProcessedAttachment["type"] {
  if (IMAGE_MIME_TYPES.includes(mimeType)) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (TEXT_MIME_TYPES.includes(mimeType)) return "text";
  return "unsupported";
}

async function getFileBuffer(attachment: Attachment): Promise<Buffer> {
  if (attachment.storageBucket === "local" || devMode || !appConfig.supabaseUrl) {
    // Local fallback path is stored as storagePath
    const localPath = attachment.storagePath.startsWith("/")
      ? attachment.storagePath
      : path.resolve(process.cwd(), attachment.storagePath);
    return fs.readFile(localPath);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(attachment.storageBucket).download(attachment.storagePath);
  if (error || !data) {
    throw new Error(`Failed to download attachment: ${error?.message || "unknown error"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const parse = pdfParse as unknown as (buffer: Buffer) => Promise<{ text: string }>;
    const data = await parse(buffer);
    return data.text;
  } catch (err) {
    logger.error({ err }, "PDF parsing failed");
    return "[PDF text extraction failed]";
  }
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (err) {
    logger.error({ err }, "DOCX parsing failed");
    return "[DOCX text extraction failed]";
  }
}

function extractTextFromTextFile(buffer: Buffer, mimeType: string): string {
  try {
    return buffer.toString("utf-8");
  } catch (err) {
    logger.error({ err, mimeType }, "Text file parsing failed");
    return "[Text extraction failed]";
  }
}

export async function processAttachment(attachment: Attachment): Promise<ProcessedAttachment> {
  const type = classifyAttachment(attachment.mimeType);
  const result: ProcessedAttachment = {
    id: attachment.id,
    filename: attachment.originalName,
    mimeType: attachment.mimeType,
    type,
  };

  const buffer = await getFileBuffer(attachment);

  if (type === "image" || type === "pdf") {
    result.base64 = buffer.toString("base64");
  } else if (type === "docx") {
    result.text = await extractTextFromDocx(buffer);
  } else if (type === "text") {
    result.text = extractTextFromTextFile(buffer, attachment.mimeType);
  } else {
    result.text = `[Unsupported file type: ${attachment.mimeType}]`;
  }

  // For PDFs, also extract text as a fallback/supplement
  if (type === "pdf") {
    result.text = await extractTextFromPdf(buffer);
  }

  return result;
}

export async function processAttachments(attachments: Attachment[]): Promise<ProcessedAttachment[]> {
  return Promise.all(attachments.map(processAttachment));
}
