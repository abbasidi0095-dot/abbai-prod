import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { appConfig, devMode } from "../config";
import { getSupabaseAdmin } from "../auth/supabase";
import { prisma } from "../utils/prisma";
import { AttachmentInput } from "../types";
import { logger } from "../utils/logger";

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/json",
  "text/markdown",
  "text/x-markdown",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateAttachment(mimeType: string, size: number): void {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`File type '${mimeType}' is not allowed`);
  }
  if (size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
}

function generateStoragePath(userId: string, filename: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  return `${userId}/${timestamp}-${random}-${filename}`;
}

export async function uploadAttachment(
  userId: string,
  input: AttachmentInput,
  conversationId?: string
) {
  validateAttachment(input.mimeType, input.size);

  const storagePath = generateStoragePath(userId, input.filename);

  if (devMode || !appConfig.supabaseUrl) {
    // Local fallback: save to uploads directory
    const uploadsDir = path.resolve(process.cwd(), "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    const localPath = path.join(uploadsDir, storagePath);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, input.buffer);

    return prisma.attachment.create({
      data: {
        userId,
        conversationId,
        filename: input.filename,
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: input.size,
        storagePath: localPath,
        storageBucket: "local",
        signedUrl: `/uploads/${storagePath}`,
      },
    });
  }

  const supabase = getSupabaseAdmin();
  const bucket = appConfig.supabaseStorageBucket;

  const { error } = await supabase.storage.from(bucket).upload(storagePath, input.buffer, {
    contentType: input.mimeType,
    upsert: false,
  });

  if (error) {
    logger.error({ error }, "Supabase storage upload failed");
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60 * 60 * 24); // 24 hours

  if (signedError) {
    logger.error({ error: signedError }, "Failed to create signed URL");
  }

  return prisma.attachment.create({
    data: {
      userId,
      conversationId,
      filename: input.filename,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: input.size,
      storagePath,
      storageBucket: bucket,
      signedUrl: signedData?.signedUrl || null,
      urlExpiresAt: signedData?.signedUrl ? new Date(Date.now() + 60 * 60 * 24 * 1000) : null,
    },
  });
}

export async function refreshSignedUrl(attachmentId: string, userId: string) {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.userId !== userId) {
    throw new Error("Attachment not found");
  }

  if (attachment.storageBucket === "local") {
    return attachment;
  }

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.storage.from(attachment.storageBucket).createSignedUrl(attachment.storagePath, 60 * 60 * 24);

  return prisma.attachment.update({
    where: { id: attachmentId },
    data: {
      signedUrl: data?.signedUrl || attachment.signedUrl,
      urlExpiresAt: data?.signedUrl ? new Date(Date.now() + 60 * 60 * 24 * 1000) : attachment.urlExpiresAt,
    },
  });
}
