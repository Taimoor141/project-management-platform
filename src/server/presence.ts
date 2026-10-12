import { PresenceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ONLINE_WINDOW_MS = 90_000;

export async function heartbeatPresence(userId: string, status: PresenceStatus = PresenceStatus.ONLINE) {
  return prisma.user.update({
    where: { id: userId },
    data: { lastSeenAt: new Date(), presenceStatus: status },
    select: { id: true, name: true, presenceStatus: true, lastSeenAt: true },
  });
}

export async function markPresenceOffline(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { presenceStatus: PresenceStatus.OFFLINE },
  });
}

export async function listOrganizationPresence(userId: string) {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId, status: "ACTIVE", organization: { archivedAt: null } },
    select: { organizationId: true },
  });
  const organizationIds = memberships.map(({ organizationId }) => organizationId);
  const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS);

  return prisma.organizationMember.findMany({
    where: {
      organizationId: { in: organizationIds },
      status: "ACTIVE",
      user: { lastSeenAt: { gte: onlineSince }, presenceStatus: { not: PresenceStatus.OFFLINE } },
    },
    select: {
      user: { select: { id: true, name: true, presenceStatus: true, lastSeenAt: true } },
      role: true,
      organization: { select: { id: true, name: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
}
