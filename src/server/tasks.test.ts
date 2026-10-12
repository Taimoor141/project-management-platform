import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOrganization, createProject } from "./organizations";
import { createTask, getDashboardSummary, listProjectTasks } from "./tasks";

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

describe("task authorization and side effects", () => {
  it("denies task creation outside the project organization", async () => {
    const owner = await prisma.user.create({
      data: { name: "Owner", email: `task-owner-${Date.now()}@example.com` },
    });
    const outsider = await prisma.user.create({
      data: { name: "Outsider", email: `task-outsider-${Date.now()}@example.com` },
    });
    const organization = await createOrganization({ name: "Task Org", slug: `task-org-${Date.now()}`, ownerId: owner.id });
    const project = await createProject({
      organizationId: organization.id,
      name: "Roadmap",
      key: "ROAD",
      createdByUserId: owner.id,
    });

    await expect(createTask({ projectId: project.id, reporterId: outsider.id, title: "Private task" })).rejects.toThrow(
      "PROJECT_ACCESS_DENIED",
    );
  });

  it("creates activity and an assignment notification for an organization member", async () => {
    const owner = await prisma.user.create({
      data: { name: "Owner", email: `task-owner-${Date.now()}@example.com` },
    });
    const assignee = await prisma.user.create({
      data: { name: "Assignee", email: `task-assignee-${Date.now()}@example.com` },
    });
    const organization = await createOrganization({
      name: "Delivery Org",
      slug: `delivery-org-${Date.now()}`,
      ownerId: owner.id,
    });
    await prisma.organizationMember.create({
      data: { organizationId: organization.id, userId: assignee.id, role: "MEMBER" },
    });
    const project = await createProject({
      organizationId: organization.id,
      name: "Release",
      key: "REL",
      createdByUserId: owner.id,
    });

    const task = await createTask({
      projectId: project.id,
      reporterId: owner.id,
      assigneeId: assignee.id,
      title: "Prepare release notes",
      priority: "HIGH",
    });

    expect(task.title).toBe("Prepare release notes");
    expect(await prisma.activityLog.count({ where: { taskId: task.id, actionType: "TASK_CREATED" } })).toBe(1);
    expect(await prisma.notification.count({ where: { entityId: task.id, recipientUserId: assignee.id } })).toBe(1);
    expect((await listProjectTasks(owner.id, project.id)).map(({ title }) => title)).toEqual(["Prepare release notes"]);
  });

  it("returns counts scoped to the signed-in user's organizations", async () => {
    const owner = await prisma.user.create({
      data: { name: "Owner", email: `dashboard-owner-${Date.now()}@example.com` },
    });
    const organization = await createOrganization({
      name: "Dashboard Org",
      slug: `dashboard-org-${Date.now()}`,
      ownerId: owner.id,
    });
    const project = await createProject({
      organizationId: organization.id,
      name: "Dashboard Project",
      key: "DASH",
      createdByUserId: owner.id,
    });
    await createTask({ projectId: project.id, reporterId: owner.id, title: "Move the work forward", status: "IN_PROGRESS" });

    const summary = await getDashboardSummary(owner.id);

    expect(summary.projects).toBe(1);
    expect(summary.tasks).toBe(1);
    expect(summary.inProgress).toBe(1);
    expect(summary.overdue).toBe(0);
  });
});
