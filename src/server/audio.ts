import { ChannelType, ConferenceStatus, Prisma, VoiceSignalType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canApproveOrganization, canAccessOrganization, getOrganizationMemberRole } from "./organizations";

const channelSchema = z.object({
  organizationId: z.string().min(1).optional(),
  projectId: z.string().min(1).nullable().optional(),
  type: z.nativeEnum(ChannelType).default(ChannelType.TEXT),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
});

const conferenceSchema = z.object({
  channelId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  scheduledFor: z.coerce.date().nullable().optional(),
  status: z.nativeEnum(ConferenceStatus).optional().default(ConferenceStatus.SCHEDULED),
});

const voiceSignalSchema = z.object({
  recipientId: z.string().min(1),
  type: z.nativeEnum(VoiceSignalType),
  payload: z.record(z.string(), z.unknown()),
});

async function getLiveVoiceChannel(userId: string, channelId: string) {
  const channel = await prisma.audioChannel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      type: true,
      organizationId: true,
      archivedAt: true,
      conferences: { where: { status: ConferenceStatus.LIVE }, select: { id: true }, take: 1 },
    },
  });
  if (!channel || channel.type !== ChannelType.AUDIO || channel.archivedAt || !(await canAccessOrganization(userId, channel.organizationId))) throw new Error("AUDIO_ACCESS_DENIED");
  if (channel.conferences.length === 0) throw new Error("CONFERENCE_NOT_LIVE");
  return channel;
}

export async function joinVoiceChannel(userId: string, channelId: string) {
  const channel = await getLiveVoiceChannel(userId, channelId);
  await prisma.voiceParticipant.upsert({
    where: { channelId_userId: { channelId: channel.id, userId } },
    create: { channelId: channel.id, userId },
    update: { updatedAt: new Date() },
  });
  const participants = await prisma.voiceParticipant.findMany({
    where: { channelId: channel.id, updatedAt: { gt: new Date(Date.now() - 30_000) } },
    include: { user: { select: { id: true, name: true } } },
  });
  return { userId, participants: participants.map(({ user }) => user) };
}

export async function pollVoiceChannel(userId: string, channelId: string) {
  const channel = await getLiveVoiceChannel(userId, channelId);
  await prisma.voiceParticipant.upsert({
    where: { channelId_userId: { channelId: channel.id, userId } },
    create: { channelId: channel.id, userId },
    update: { updatedAt: new Date() },
  });
  const cutoff = new Date(Date.now() - 30_000);
  const [participants, signals] = await Promise.all([
    prisma.voiceParticipant.findMany({
      where: { channelId: channel.id, updatedAt: { gt: cutoff } },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.voiceSignal.findMany({
      where: { channelId: channel.id, recipientId: userId },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
  ]);
  if (signals.length > 0) await prisma.voiceSignal.deleteMany({ where: { id: { in: signals.map(({ id }) => id) } } });
  return {
    participants: participants.map(({ user }) => user),
    signals: signals.map(({ id: _id, channelId: _channelId, recipientId: _recipientId, createdAt: _createdAt, ...signal }) => signal),
  };
}

export async function sendVoiceSignal(userId: string, channelId: string, input: unknown) {
  const channel = await getLiveVoiceChannel(userId, channelId);
  const parsed = voiceSignalSchema.parse(input);
  if (parsed.recipientId === userId) throw new Error("INVALID_VOICE_RECIPIENT");
  const activeParticipants = await prisma.voiceParticipant.findMany({
    where: { channelId: channel.id, userId: { in: [userId, parsed.recipientId] }, updatedAt: { gt: new Date(Date.now() - 30_000) } },
    select: { userId: true },
  });
  if (!activeParticipants.some(({ userId: participantId }) => participantId === userId)) throw new Error("VOICE_SENDER_NOT_JOINED");
  if (!activeParticipants.some(({ userId: participantId }) => participantId === parsed.recipientId)) throw new Error("VOICE_RECIPIENT_NOT_FOUND");
  return prisma.voiceSignal.create({
    data: {
      channelId: channel.id,
      senderId: userId,
      recipientId: parsed.recipientId,
      type: parsed.type,
      payload: parsed.payload as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
}

export async function leaveVoiceChannel(userId: string, channelId: string) {
  await prisma.voiceParticipant.deleteMany({ where: { channelId, userId } });
  await prisma.voiceSignal.deleteMany({ where: { channelId, OR: [{ senderId: userId }, { recipientId: userId }] } });
}

export async function listAudioChannels(userId: string) {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId, status: "ACTIVE", organization: { archivedAt: null } },
    select: { organizationId: true },
  });
  const ids = memberships.map(({ organizationId }) => organizationId);
  return prisma.audioChannel.findMany({
    where: { organizationId: { in: ids }, archivedAt: null },
    include: {
      organization: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      conferences: { where: { status: { in: [ConferenceStatus.SCHEDULED, ConferenceStatus.LIVE] } }, orderBy: { scheduledFor: "asc" }, take: 3 },
    },
    orderBy: [{ organizationId: "asc" }, { name: "asc" }],
  });
}

export async function createAudioChannel(userId: string, input: unknown) {
  const parsed = channelSchema.parse(input);
  const organizationId = parsed.organizationId ?? (await prisma.organizationMember.findFirst({
    where: { userId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } },
    select: { organizationId: true },
  }))?.organizationId;
  if (!organizationId || !(await canApproveOrganization(userId, organizationId))) {
    throw new Error("AUDIO_ADMIN_REQUIRED");
  }
  if (parsed.projectId) {
    const project = await prisma.project.findFirst({ where: { id: parsed.projectId, organizationId, archivedAt: null }, select: { id: true } });
    if (!project) throw new Error("PROJECT_NOT_IN_ORGANIZATION");
  }
  return prisma.audioChannel.create({ data: { ...parsed, organizationId, createdByUserId: userId } });
}

export async function createConferenceCall(userId: string, input: unknown) {
  const parsed = conferenceSchema.parse(input);
  const channel = await prisma.audioChannel.findUnique({ where: { id: parsed.channelId }, select: { id: true, organizationId: true, name: true, archivedAt: true } });
  if (!channel || channel.archivedAt || !(await canAccessOrganization(userId, channel.organizationId))) throw new Error("AUDIO_ACCESS_DENIED");
  if (!(await canApproveOrganization(userId, channel.organizationId))) throw new Error("AUDIO_ADMIN_REQUIRED");
  return prisma.conferenceCall.create({ data: { ...parsed, hostUserId: userId, status: parsed.status } });
}

export async function endConferenceCall(userId: string, channelId: string) {
  const channel = await prisma.audioChannel.findUnique({ where: { id: channelId }, select: { id: true, organizationId: true, archivedAt: true } });
  if (!channel || channel.archivedAt || !(await canAccessOrganization(userId, channel.organizationId))) throw new Error("AUDIO_ACCESS_DENIED");
  if (!(await canApproveOrganization(userId, channel.organizationId))) throw new Error("AUDIO_ADMIN_REQUIRED");

  const conference = await prisma.conferenceCall.findFirst({
    where: { channelId, status: { in: [ConferenceStatus.SCHEDULED, ConferenceStatus.LIVE] } },
    orderBy: { createdAt: "desc" },
  });

  if (!conference) throw new Error("CONFERENCE_NOT_FOUND");

  return prisma.conferenceCall.update({
    where: { id: conference.id },
    data: { status: ConferenceStatus.ENDED, endedAt: new Date() },
  });
}

export async function joinableAudioChannels(userId: string) {
  const channels = await listAudioChannels(userId);
  return channels.map((channel) => ({ ...channel, canManage: false }));
}

export async function listChannelMessages(userId: string, channelId: string) {
  const channel = await prisma.audioChannel.findUnique({ where: { id: channelId }, select: { organizationId: true } });
  if (!channel || !(await canAccessOrganization(userId, channel.organizationId))) throw new Error("AUDIO_ACCESS_DENIED");
  return prisma.channelMessage.findMany({
    where: { channelId },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
}

export async function createChannelMessage(userId: string, channelId: string, body: unknown) {
  const parsed = z.object({ body: z.string().trim().min(1).max(2000) }).parse(body);
  const channel = await prisma.audioChannel.findUnique({ where: { id: channelId }, select: { organizationId: true } });
  if (!channel || !(await canAccessOrganization(userId, channel.organizationId))) throw new Error("AUDIO_ACCESS_DENIED");
  return prisma.channelMessage.create({
    data: { channelId, authorId: userId, body: parsed.body },
    include: { author: { select: { id: true, name: true } } },
  });
}
