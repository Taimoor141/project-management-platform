import { ApprovalStatus, Role } from "@prisma/client";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Organization name must be at least 2 characters long"),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters long")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  ownerId: z.string().min(1),
});

export const createProjectSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(2, "Project name must be at least 2 characters long"),
  key: z.string().trim().min(2, "Project key must be at least 2 characters long").max(10),
  createdByUserId: z.string().min(1),
});

export async function generateOrganizationAccessCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const accessCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const existing = await prisma.organization.findUnique({ where: { accessCode }, select: { id: true } });
    if (!existing) return accessCode;
  }
  throw new Error("ORGANIZATION_CODE_UNAVAILABLE");
}

export async function ensureOrganizationAccessCode(organizationId: string) {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { accessCode: true } });
  if (!organization) throw new Error("ORGANIZATION_NOT_FOUND");
  if (organization.accessCode) return organization.accessCode;

  const accessCode = await generateOrganizationAccessCode();
  const updated = await prisma.organization.updateMany({
    where: { id: organizationId, accessCode: null },
    data: { accessCode },
  });
  if (updated.count === 1) return accessCode;

  const current = await prisma.organization.findUnique({ where: { id: organizationId }, select: { accessCode: true } });
  if (current?.accessCode) return current.accessCode;
  return ensureOrganizationAccessCode(organizationId);
}

async function ensureBootstrapWorkspaceMembership(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!bootstrapEmail || user?.email.toLowerCase() !== bootstrapEmail) return;

  const organizationId = await prisma.$transaction(async (transaction) => {
    const bootstrapName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Workspace Admin";
    const workspaceSlug = process.env.BOOTSTRAP_ADMIN_ORG_SLUG?.trim() || "admin-workspace";
    let organization = await transaction.organization.findUnique({
      where: { slug: workspaceSlug },
      select: { id: true },
    });
    if (!organization) {
      organization = await transaction.organization.create({
        data: {
          name: `${bootstrapName} Workspace`,
          slug: workspaceSlug,
          ownerId: userId,
          accessCode: await generateOrganizationAccessCode(),
        },
        select: { id: true },
      });
    }

    const membership = await transaction.organizationMember.findFirst({
      where: { userId, organizationId: organization.id },
      select: { id: true, role: true, status: true },
    });
    if (!membership) {
      await transaction.organizationMember.create({
        data: { organizationId: organization.id, userId, role: Role.OWNER, status: "ACTIVE" },
      });
    } else if (membership.role !== Role.OWNER || membership.status !== "ACTIVE") {
      await transaction.organizationMember.update({
        where: { id: membership.id },
        data: { role: Role.OWNER, status: "ACTIVE" },
      });
    }
    return organization.id;
  });
  await ensureOrganizationAccessCode(organizationId);
}

export async function getOrganizationMemberRole(userId: string, organizationId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
      status: "ACTIVE",
    },
    select: { role: true },
  });

  return membership?.role ?? null;
}

export async function getUserWorkspaceRole(userId: string) {
  await ensureBootstrapWorkspaceMembership(userId);
  const memberships = await prisma.organizationMember.findMany({
    where: { userId, status: "ACTIVE", organization: { archivedAt: null } },
    select: { role: true },
  });

  if (memberships.some(({ role }) => role === Role.OWNER)) {
    return Role.OWNER;
  }
  if (memberships.some(({ role }) => role === Role.ADMIN)) {
    return Role.ADMIN;
  }
  return memberships.length > 0 ? Role.MEMBER : null;
}

export async function canAccessOrganization(userId: string, organizationId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  return Boolean(membership);
}

export async function canApproveOrganization(userId: string, organizationId: string) {
  const role = await getOrganizationMemberRole(userId, organizationId);
  return role === Role.OWNER || role === Role.ADMIN;
}

export async function getOrganizationApproverIds(organizationId: string, excludeUserId?: string) {
  const approvers = await prisma.organizationMember.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      role: { in: [Role.OWNER, Role.ADMIN] },
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    select: { userId: true },
  });

  return approvers.map(({ userId }) => userId);
}

export async function listUserOrganizations(userId: string) {
  return prisma.organization.findMany({
    where: {
      members: {
        some: {
          userId,
          status: "ACTIVE",
        },
      },
      archivedAt: null,
    },
    include: {
      members: {
        where: { userId, status: "ACTIVE" },
        select: { role: true },
      },
      _count: { select: { members: true, projects: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function listManageableOrganizations(userId: string) {
  const organizations = await prisma.organization.findMany({
    where: {
      archivedAt: null,
      members: {
        some: {
          userId,
          status: "ACTIVE",
          role: { in: [Role.OWNER, Role.ADMIN] },
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      accessCode: true,
      members: {
        where: { status: "ACTIVE" },
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          role: true,
          joinedAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return Promise.all(organizations.map(async (organization) => ({
    ...organization,
    accessCode: organization.accessCode ?? await ensureOrganizationAccessCode(organization.id),
  })));
}

export async function listOrganizationProjects(userId: string, organizationId: string) {
  if (!(await canAccessOrganization(userId, organizationId))) {
    throw new Error("USER_NOT_IN_ORGANIZATION");
  }

  return prisma.project.findMany({
    where: {
      organizationId,
      archivedAt: null,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createOrganization(input: { name: string; slug: string; ownerId: string }) {
  const parsed = createOrganizationSchema.parse(input);

  const existingOrganization = await prisma.organization.findUnique({
    where: {
      slug: parsed.slug,
    },
  });

  if (existingOrganization) {
    throw new Error("ORGANIZATION_SLUG_TAKEN");
  }
  const accessCode = await generateOrganizationAccessCode();

  return prisma.$transaction(async (transaction) => {
    const organization = await transaction.organization.create({
      data: {
        name: parsed.name,
        slug: parsed.slug,
        ownerId: parsed.ownerId,
        accessCode,
      },
    });

    await transaction.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: parsed.ownerId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    return organization;
  });
}

export async function createProject(input: { organizationId: string; name: string; key: string; createdByUserId: string }) {
  const parsed = createProjectSchema.parse(input);

  const role = await getOrganizationMemberRole(parsed.createdByUserId, parsed.organizationId);
  if (!role) {
    throw new Error("USER_NOT_IN_ORGANIZATION");
  }

  const isApprover = role === Role.OWNER || role === Role.ADMIN;
  const approvalStatus = isApprover ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING;
  const approverIds = isApprover ? [] : await getOrganizationApproverIds(parsed.organizationId, parsed.createdByUserId);

  return prisma.$transaction(async (transaction) => {
    const project = await transaction.project.create({
      data: {
        organizationId: parsed.organizationId,
        name: parsed.name,
        key: parsed.key,
        createdByUserId: parsed.createdByUserId,
        status: "ACTIVE",
        visibility: "PRIVATE",
        approvalStatus,
        approvedByUserId: isApprover ? parsed.createdByUserId : null,
        approvedAt: isApprover ? new Date() : null,
      },
    });

    await transaction.activityLog.create({
      data: {
        organizationId: parsed.organizationId,
        projectId: project.id,
        actorUserId: parsed.createdByUserId,
        actionType: "PROJECT_CREATED",
        actionDetail: JSON.stringify({ approvalStatus }),
      },
    });

    if (approverIds.length > 0) {
      await transaction.notification.createMany({
        data: approverIds.map((recipientUserId) => ({
          recipientUserId,
          organizationId: parsed.organizationId,
          type: "PROJECT_APPROVAL_REQUESTED" as const,
          entityType: "PROJECT",
          entityId: project.id,
          message: `${project.name} is waiting for approval`,
        })),
      });
    }

    return project;
  });
}
