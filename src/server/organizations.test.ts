import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  canAccessOrganization,
  createOrganization,
  createProject,
  getOrganizationMemberRole,
} from "./organizations";

async function resetDb() {
  await prisma.activityLog.deleteMany();
  await prisma.taskLabel.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.label.deleteMany();
  await prisma.project.deleteMany();
  await prisma.organizationInvitation.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}

afterEach(async () => {
  await resetDb();
});

describe("organization and project authorization", () => {
  it("creates an organization and marks the creator as owner", async () => {
    const user = await prisma.user.create({
      data: {
        name: "Owner User",
        email: `owner-${Date.now()}@example.com`,
      },
    });

    const organization = await createOrganization({
      name: "Acme Studio",
      slug: "acme-studio",
      ownerId: user.id,
    });

    expect(organization.name).toBe("Acme Studio");
    expect(await getOrganizationMemberRole(user.id, organization.id)).toBe("OWNER");
  });

  it("denies access for non-members", async () => {
    const owner = await prisma.user.create({
      data: {
        name: "Owner",
        email: `owner-${Date.now()}@example.com`,
      },
    });
    const outsider = await prisma.user.create({
      data: {
        name: "Outsider",
        email: `outsider-${Date.now()}@example.com`,
      },
    });

    const organization = await createOrganization({
      name: "Outreach Org",
      slug: "outreach-org",
      ownerId: owner.id,
    });

    expect(await canAccessOrganization(outsider.id, organization.id)).toBe(false);
  });

  it("allows project creation only for organization members", async () => {
    const owner = await prisma.user.create({
      data: {
        name: "Owner",
        email: `owner-${Date.now()}@example.com`,
      },
    });
    const member = await prisma.user.create({
      data: {
        name: "Member",
        email: `member-${Date.now()}@example.com`,
      },
    });

    const organization = await createOrganization({
      name: "Launch Org",
      slug: "launch-org",
      ownerId: owner.id,
    });

    await prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: member.id,
        role: "MEMBER",
      },
    });

    const project = await createProject({
      organizationId: organization.id,
      name: "Website Redesign",
      key: "WEB",
      createdByUserId: member.id,
    });

    expect(project.name).toBe("Website Redesign");
    expect(project.organizationId).toBe(organization.id);
  });
});
