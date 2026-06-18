import { prisma } from "../utils/prisma";
import { AuthenticatedUser } from "../types";
import { NotFoundError } from "../utils/errors";

export async function findOrCreateUser(supabaseUid: string, email: string): Promise<AuthenticatedUser> {
  const existing = await prisma.user.findUnique({
    where: { supabaseUid },
    include: { profile: true },
  });

  if (existing) {
    return {
      id: existing.id,
      supabaseUid: existing.supabaseUid,
      email: existing.email,
      role: existing.role as "USER" | "ADMIN" | "MODERATOR",
      profile: existing.profile,
    };
  }

  const created = await prisma.user.create({
    data: {
      supabaseUid,
      email,
      role: "USER",
      profile: { create: {} },
      modelSettings: { create: {} },
    },
    include: { profile: true },
  });

  return {
    id: created.id,
    supabaseUid: created.supabaseUid,
    email: created.email,
    role: created.role as "USER" | "ADMIN" | "MODERATOR",
    profile: created.profile,
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { profile: true, modelSettings: true },
  });
  if (!user) throw new NotFoundError("User");
  return user;
}

export async function updateProfile(userId: string, data: { fullName?: string; bio?: string; username?: string; avatarUrl?: string }) {
  return prisma.profile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

export async function getModelSettings(userId: string) {
  const settings = await prisma.modelSettings.findUnique({
    where: { userId },
  });
  if (!settings) {
    return prisma.modelSettings.create({ data: { userId } });
  }
  return settings;
}

export async function updateModelSettings(userId: string, data: Partial<{
  defaultModel: string;
  defaultProvider: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  systemPrompt: string;
}>) {
  return prisma.modelSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}
