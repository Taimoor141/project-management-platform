import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { comparePassword, hashPassword } from "@/lib/password";
import { ensureOrganizationAccessCode, generateOrganizationAccessCode } from "./organizations";

const accountDetailsSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(12, "Password must be at least 12 characters long"),
});

const provisionAccountSchema = accountDetailsSchema.extend({
  organizationId: z.string().min(1),
  role: z.enum([Role.MEMBER, Role.ADMIN]),
});

export const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(12, "Password must be at least 12 characters long"),
  organizationCode: z.string().regex(/^\d{6}$/, "Enter a valid six-digit organization code").optional(),
});

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  const parsed = accountDetailsSchema.parse(input);
  const normalizedEmail = parsed.email.toLowerCase();
  if (await getUserByEmail(normalizedEmail)) throw new Error("EMAIL_ALREADY_REGISTERED");

  return prisma.user.create({
    data: { name: parsed.name, email: normalizedEmail, passwordHash: await hashPassword(parsed.password) },
    select: { id: true, name: true, email: true },
  });
}

export async function provisionOrganizationAccount(creatorId: string, input: unknown) {
  const parsed = provisionAccountSchema.parse(input);
  const normalizedEmail = parsed.email.toLowerCase();
  const passwordHash = await hashPassword(parsed.password);

  try {
    return await prisma.$transaction(async (transaction) => {
      const creatorMembership = await transaction.organizationMember.findFirst({
        where: {
          userId: creatorId,
          organizationId: parsed.organizationId,
          status: "ACTIVE",
          role: { in: [Role.OWNER, Role.ADMIN] },
          organization: { archivedAt: null },
        },
        select: { id: true },
      });
      if (!creatorMembership) throw new Error("ORGANIZATION_ADMIN_REQUIRED");

      const existingUser = await transaction.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
      if (existingUser) throw new Error("EMAIL_ALREADY_REGISTERED");

      const user = await transaction.user.create({
        data: { name: parsed.name, email: normalizedEmail, passwordHash },
        select: { id: true, name: true, email: true },
      });
      await transaction.organizationMember.create({
        data: {
          organizationId: parsed.organizationId,
          userId: user.id,
          role: parsed.role,
          status: "ACTIVE",
        },
      });

      return { ...user, role: parsed.role };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("EMAIL_ALREADY_REGISTERED");
    }
    throw error;
  }
}

export async function authorizeCredentials(input: { email: string; password: string; organizationCode?: string }) {
  const parsed = credentialsSchema.parse(input);
  const normalizedEmail = parsed.email.trim().toLowerCase();
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const bootstrapName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Workspace Admin";

  if (bootstrapEmail && bootstrapPassword && normalizedEmail === bootstrapEmail && parsed.password === bootstrapPassword) {
    let adminUser = await getUserByEmail(normalizedEmail);
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          name: bootstrapName,
          email: normalizedEmail,
          passwordHash: await hashPassword(parsed.password),
        },
      });
    } else if (!adminUser.passwordHash || !(await comparePassword(parsed.password, adminUser.passwordHash))) {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { name: bootstrapName, passwordHash: await hashPassword(parsed.password) },
      });
      adminUser = await prisma.user.findUnique({
        where: { id: adminUser.id },
      });
    }

    if (!adminUser) {
      return null;
    }

    const workspaceSlug = process.env.BOOTSTRAP_ADMIN_ORG_SLUG?.trim() || "admin-workspace";
    let workspace = await prisma.organization.findUnique({
      where: { slug: workspaceSlug },
      select: { id: true, name: true, accessCode: true },
    });

    if (!workspace) {
      workspace = await prisma.organization.create({
        data: {
          name: `${bootstrapName} Workspace`,
          slug: workspaceSlug,
          ownerId: adminUser.id,
          accessCode: await generateOrganizationAccessCode(),
        },
        select: { id: true, name: true, accessCode: true },
      });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: adminUser.id, organizationId: workspace.id },
      select: { id: true, role: true, status: true },
    });

    if (!membership) {
      await prisma.organizationMember.create({
        data: {
          organizationId: workspace.id,
          userId: adminUser.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
    } else if (membership.role !== Role.OWNER || membership.status !== "ACTIVE") {
      await prisma.organizationMember.update({
        where: { id: membership.id },
        data: { role: Role.OWNER, status: "ACTIVE" },
      });
    }

    const defaultOrganizationCode = workspace.accessCode ?? await ensureOrganizationAccessCode(workspace.id);
    const selectedMembership = parsed.organizationCode
      ? await prisma.organizationMember.findFirst({
          where: {
            userId: adminUser.id,
            status: "ACTIVE",
            organization: { accessCode: parsed.organizationCode, archivedAt: null },
          },
          select: { organization: { select: { id: true, name: true, accessCode: true } } },
        })
      : null;
    if (parsed.organizationCode && !selectedMembership) return null;
    const selectedOrganization = selectedMembership?.organization ?? {
      id: workspace.id,
      name: workspace.name,
      accessCode: defaultOrganizationCode,
    };

    return {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      organizationId: selectedOrganization.id,
      organizationName: selectedOrganization.name,
      organizationCode: selectedOrganization.accessCode ?? defaultOrganizationCode,
    };
  }

  const user = await getUserByEmail(normalizedEmail);

  if (!user || !user.passwordHash) {
    return null;
  }

  const validPassword = await comparePassword(parsed.password, user.passwordHash);
  if (!validPassword) {
    return null;
  }

  if (!parsed.organizationCode) return null;
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: user.id,
      status: "ACTIVE",
      organization: { accessCode: parsed.organizationCode, archivedAt: null },
    },
    select: { organizationId: true, organization: { select: { name: true, accessCode: true } } },
  });
  if (!membership?.organization.accessCode) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    organizationCode: membership.organization.accessCode,
  };
}

export const changePasswordSchema = z.object({
  userId: z.string().min(1),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, "Password must be at least 12 characters long"),
});

export async function changeUserPassword(input: unknown) {
  const parsed = changePasswordSchema.parse(input);
  const user = await prisma.user.findUnique({ where: { id: parsed.userId }, select: { passwordHash: true } });
  if (!user?.passwordHash || !(await comparePassword(parsed.currentPassword, user.passwordHash))) {
    throw new Error("CURRENT_PASSWORD_INVALID");
  }

  return prisma.user.update({
    where: { id: parsed.userId },
    data: { passwordHash: await hashPassword(parsed.newPassword) },
    select: { id: true },
  });
}
