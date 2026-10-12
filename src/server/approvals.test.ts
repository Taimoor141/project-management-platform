import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOrganization, createProject } from "./organizations";
import { decideProjectApproval, decideTaskApproval, updateProjectSubmission, updateTaskSubmission } from "./approvals";
import { createTask } from "./tasks";

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

describe("organization approval workflow", () => {
  it("holds member-created projects until an admin approves them", async () => {
    const owner = await prisma.user.create({
      data: { name: "Owner", email: `approval-owner-${Date.now()}@example.com` },
    });
    const member = await prisma.user.create({
      data: { name: "Member", email: `approval-member-${Date.now()}@example.com` },
    });
    const organization = await createOrganization({
      name: "Approval Org",
      slug: `approval-org-${Date.now()}`,
      ownerId: owner.id,
    });
    await prisma.organizationMember.create({
      data: { organizationId: organization.id, userId: member.id, role: "MEMBER" },
    });

    const project = await createProject({
      organizationId: organization.id,
      name: "Member Project",
      key: "MEM",
      createdByUserId: member.id,
    });

    expect(project.approvalStatus).toBe("PENDING");
    await expect(decideProjectApproval(member.id, project.id, { decision: "APPROVED" })).rejects.toThrow(
      "APPROVAL_ACCESS_DENIED",
    );

    const rejected = await decideProjectApproval(owner.id, project.id, { decision: "REJECTED", reason: "Add a clearer scope" });
    expect(rejected.approvalStatus).toBe("REJECTED");
    expect(rejected.rejectionPermanent).toBe(false);

    const resubmitted = await updateProjectSubmission(member.id, project.id, { name: "Resubmitted Project" });
    expect(resubmitted.approvalStatus).toBe("PENDING");

    const approved = await decideProjectApproval(owner.id, project.id, { decision: "APPROVED" });
    expect(approved.approvalStatus).toBe("APPROVED");
    expect(await prisma.notification.count({ where: { recipientUserId: member.id, entityId: project.id } })).toBe(2);
  });

  it("holds member-created tasks until an owner approves them", async () => {
    const owner = await prisma.user.create({
      data: { name: "Owner", email: `task-approval-owner-${Date.now()}@example.com` },
    });
    const member = await prisma.user.create({
      data: { name: "Member", email: `task-approval-member-${Date.now()}@example.com` },
    });
    const organization = await createOrganization({
      name: "Task Approval Org",
      slug: `task-approval-org-${Date.now()}`,
      ownerId: owner.id,
    });
    await prisma.organizationMember.create({
      data: { organizationId: organization.id, userId: member.id, role: "MEMBER" },
    });
    const project = await createProject({
      organizationId: organization.id,
      name: "Approved Project",
      key: "APP",
      createdByUserId: owner.id,
    });

    const task = await createTask({ projectId: project.id, reporterId: member.id, title: "Needs review" });
    expect(task.approvalStatus).toBe("PENDING");

    const rejected = await decideTaskApproval(owner.id, task.id, { decision: "REJECTED", permanent: true });
    expect(rejected.approvalStatus).toBe("REJECTED");
    expect(rejected.rejectionPermanent).toBe(true);
    await expect(updateTaskSubmission(member.id, task.id, { title: "Updated task" })).rejects.toThrow(
      "SUBMISSION_PERMANENTLY_REJECTED",
    );
    expect(await prisma.notification.count({ where: { recipientUserId: member.id, entityId: task.id } })).toBe(1);
  });
});
