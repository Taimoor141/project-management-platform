import { ConferenceStatus, Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { authorizeCredentials, credentialsSchema, provisionOrganizationAccount } from "./auth";
import { createConferenceCall, endConferenceCall } from "./audio";
import { createOrganization } from "./organizations";

describe("credentials validation", () => {
  it("accepts valid credentials input", () => {
    const parsed = credentialsSchema.parse({
      email: "user@example.com",
      password: "TestPassword123!",
      organizationCode: "084201",
    });

    expect(parsed.email).toBe("user@example.com");
    expect(parsed.password).toBe("TestPassword123!");
    expect(parsed.organizationCode).toBe("084201");
  });

  it("rejects short passwords", () => {
    expect(() =>
      credentialsSchema.parse({
        email: "user@example.com",
        password: "short",
      }),
    ).toThrow();
  });

  it("rejects malformed organization codes", () => {
    expect(() => credentialsSchema.parse({
      email: "user@example.com",
      password: "TestPassword123!",
      organizationCode: "12345",
    })).toThrow();
  });

  it("lets organization admins create employee and admin accounts", async () => {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const owner = await prisma.user.create({ data: { name: "Workspace Owner", email: `owner-${unique}@example.com` } });
    const organization = await createOrganization({
      name: `Provisioning ${unique}`,
      slug: `provisioning-${unique}`,
      ownerId: owner.id,
    });
    const admin = await prisma.user.create({ data: { name: "Workspace Admin", email: `admin-${unique}@example.com` } });
    await prisma.organizationMember.create({
      data: { organizationId: organization.id, userId: admin.id, role: Role.ADMIN, status: "ACTIVE" },
    });

    const email = `employee-${unique}@example.com`;
    const employee = await provisionOrganizationAccount(admin.id, {
      organizationId: organization.id,
      name: "Test Employee",
      email,
      password: "TestPassword123!",
      role: Role.MEMBER,
    });
    expect(employee).toMatchObject({ name: "Test Employee", email, role: Role.MEMBER });

    const organizationCode = organization.accessCode ?? "";
    const login = await authorizeCredentials({ email, password: "TestPassword123!", organizationCode });
    expect(login).toMatchObject({
      id: employee.id,
      email,
      name: "Test Employee",
      organizationId: organization.id,
      organizationName: organization.name,
      organizationCode,
    });
    await expect(authorizeCredentials({ email, password: "TestPassword123!", organizationCode: "000000" })).resolves.toBeNull();
    await expect(authorizeCredentials({ email, password: "TestPassword123!" })).resolves.toBeNull();

    const otherAdmin = await provisionOrganizationAccount(admin.id, {
      organizationId: organization.id,
      name: "Second Admin",
      email: `second-admin-${unique}@example.com`,
      password: "TestPassword123!",
      role: Role.ADMIN,
    });
    expect(otherAdmin.role).toBe(Role.ADMIN);

    await expect(provisionOrganizationAccount(employee.id, {
      organizationId: organization.id,
      name: "Unauthorized Account",
      email: `blocked-${unique}@example.com`,
      password: "TestPassword123!",
      role: Role.ADMIN,
    })).rejects.toThrow("ORGANIZATION_ADMIN_REQUIRED");
  });

  it("starts and ends a live voice conference", async () => {
    const email = `conference-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { name: "Conference Host", email, passwordHash: "placeholder-hash" },
      select: { id: true, email: true, name: true },
    });

    const organization = await prisma.organization.create({
      data: {
        name: `Conference Org ${Date.now()}`,
        slug: `conference-org-${Date.now()}`,
        ownerId: user.id,
      },
      select: { id: true },
    });

    await prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: Role.OWNER,
        status: "ACTIVE",
      },
    });

    const channel = await prisma.audioChannel.create({
      data: {
        organizationId: organization.id,
        name: `Standup ${Date.now()}`,
        type: "AUDIO",
        createdByUserId: user.id,
      },
      select: { id: true },
    });

    const conference = await createConferenceCall(user.id, {
      channelId: channel.id,
      title: "Daily standup",
      status: ConferenceStatus.LIVE,
      scheduledFor: null,
    });

    expect(conference.status).toBe(ConferenceStatus.LIVE);

    const ended = await endConferenceCall(user.id, channel.id);
    expect(ended.status).toBe(ConferenceStatus.ENDED);
  });
});
