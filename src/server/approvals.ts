import { ApprovalStatus, Role, TaskPriority, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canApproveOrganization, getOrganizationApproverIds } from "./organizations";

export const approvalDecisionSchema = z.object({
  decision: z.enum([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED]),
  reason: z.string().trim().max(500).optional(),
  permanent: z.boolean().default(false),
});

const projectEditSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    key: z.string().trim().min(2).max(10).regex(/^[A-Z0-9-]+$/).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one project field is required");

const taskEditSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one task field is required");

export async function listPendingApprovals(userId: string) {
  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId,
      status: "ACTIVE",
      role: { in: [Role.OWNER, Role.ADMIN] },
      organization: { archivedAt: null },
    },
    select: { organizationId: true },
  });
  const organizationIds = memberships.map(({ organizationId }) => organizationId);

  if (organizationIds.length === 0) {
    return { projects: [], tasks: [] };
  }

  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: { in: organizationIds }, approvalStatus: ApprovalStatus.PENDING, archivedAt: null },
      select: { id: true, name: true, key: true, createdBy: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.findMany({
      where: {
        project: { organizationId: { in: organizationIds } },
        approvalStatus: ApprovalStatus.PENDING,
        archivedAt: null,
      },
      select: { id: true, title: true, project: { select: { name: true } }, reporter: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return { projects, tasks };
}

async function requireApprovalAccess(userId: string, organizationId: string) {
  if (!(await canApproveOrganization(userId, organizationId))) {
    throw new Error("APPROVAL_ACCESS_DENIED");
  }
}

export async function decideProjectApproval(userId: string, projectId: string, input: unknown) {
  const parsed = approvalDecisionSchema.parse(input);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      createdByUserId: true,
      approvalStatus: true,
      rejectionPermanent: true,
    },
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }
  await requireApprovalAccess(userId, project.organizationId);
  if (project.approvalStatus !== ApprovalStatus.PENDING) {
    throw new Error("APPROVAL_ALREADY_DECIDED");
  }

  return prisma.$transaction(async (transaction) => {
    const updatedProject = await transaction.project.update({
      where: { id: project.id },
      data: {
        approvalStatus: parsed.decision,
        approvedByUserId: userId,
        approvedAt: new Date(),
        rejectionReason: parsed.decision === ApprovalStatus.REJECTED ? parsed.reason : null,
        rejectionPermanent: parsed.decision === ApprovalStatus.REJECTED && parsed.permanent,
      },
    });

    await transaction.activityLog.create({
      data: {
        organizationId: project.organizationId,
        projectId: project.id,
        actorUserId: userId,
        actionType: parsed.decision === ApprovalStatus.APPROVED ? "PROJECT_APPROVED" : "PROJECT_REJECTED",
        actionDetail: parsed.reason ? JSON.stringify({ reason: parsed.reason }) : null,
      },
    });

    await transaction.notification.create({
      data: {
        recipientUserId: project.createdByUserId,
        organizationId: project.organizationId,
        type: "APPROVAL_DECISION",
        entityType: "PROJECT",
        entityId: project.id,
        message: `${project.name} was ${parsed.decision.toLowerCase()}${parsed.decision === ApprovalStatus.REJECTED && parsed.permanent ? " permanently" : ""}`,
      },
    });

    return updatedProject;
  });
}

export async function decideTaskApproval(userId: string, taskId: string, input: unknown) {
  const parsed = approvalDecisionSchema.parse(input);
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      projectId: true,
      reporterId: true,
      approvalStatus: true,
      rejectionPermanent: true,
      project: { select: { organizationId: true } },
    },
  });

  if (!task) {
    throw new Error("TASK_NOT_FOUND");
  }
  await requireApprovalAccess(userId, task.project.organizationId);
  if (task.approvalStatus !== ApprovalStatus.PENDING) {
    throw new Error("APPROVAL_ALREADY_DECIDED");
  }

  return prisma.$transaction(async (transaction) => {
    const updatedTask = await transaction.task.update({
      where: { id: task.id },
      data: {
        approvalStatus: parsed.decision,
        approvedByUserId: userId,
        approvedAt: new Date(),
        rejectionReason: parsed.decision === ApprovalStatus.REJECTED ? parsed.reason : null,
        rejectionPermanent: parsed.decision === ApprovalStatus.REJECTED && parsed.permanent,
      },
    });

    await transaction.activityLog.create({
      data: {
        organizationId: task.project.organizationId,
        projectId: task.projectId,
        taskId: task.id,
        actorUserId: userId,
        actionType: parsed.decision === ApprovalStatus.APPROVED ? "TASK_APPROVED" : "TASK_REJECTED",
        actionDetail: parsed.reason ? JSON.stringify({ reason: parsed.reason }) : null,
      },
    });

    await transaction.notification.create({
      data: {
        recipientUserId: task.reporterId,
        organizationId: task.project.organizationId,
        type: "APPROVAL_DECISION",
        entityType: "TASK",
        entityId: task.id,
        message: `${task.title} was ${parsed.decision.toLowerCase()}${parsed.decision === ApprovalStatus.REJECTED && parsed.permanent ? " permanently" : ""}`,
      },
    });

    return updatedTask;
  });
}

export async function updateProjectSubmission(userId: string, projectId: string, input: unknown) {
  const parsed = projectEditSchema.parse(input);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      createdByUserId: true,
      approvalStatus: true,
      rejectionPermanent: true,
    },
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }
  if (project.createdByUserId !== userId) {
    throw new Error("SUBMISSION_EDIT_DENIED");
  }
  if (project.rejectionPermanent) {
    throw new Error("SUBMISSION_PERMANENTLY_REJECTED");
  }
  if (project.approvalStatus === ApprovalStatus.APPROVED) {
    throw new Error("SUBMISSION_NOT_EDITABLE");
  }

  const approverIds = await getOrganizationApproverIds(project.organizationId, userId);
  return prisma.$transaction(async (transaction) => {
    const updatedProject = await transaction.project.update({
      where: { id: project.id },
      data: {
        ...parsed,
        approvalStatus: ApprovalStatus.PENDING,
        approvedByUserId: null,
        approvedAt: null,
        rejectionReason: null,
        rejectionPermanent: false,
      },
    });

    await transaction.activityLog.create({
      data: {
        organizationId: project.organizationId,
        projectId: project.id,
        actorUserId: userId,
        actionType: "PROJECT_UPDATED",
        actionDetail: JSON.stringify({ resubmitted: project.approvalStatus === ApprovalStatus.REJECTED }),
      },
    });

    if (approverIds.length > 0) {
      await transaction.notification.createMany({
        data: approverIds.map((recipientUserId) => ({
          recipientUserId,
          organizationId: project.organizationId,
          type: "PROJECT_APPROVAL_REQUESTED" as const,
          entityType: "PROJECT",
          entityId: project.id,
          message: `${updatedProject.name} was resubmitted for approval`,
        })),
      });
    }

    return updatedProject;
  });
}

export async function updateTaskSubmission(userId: string, taskId: string, input: unknown) {
  const parsed = taskEditSchema.parse(input);
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      reporterId: true,
      projectId: true,
      approvalStatus: true,
      rejectionPermanent: true,
      project: { select: { organizationId: true } },
    },
  });

  if (!task) {
    throw new Error("TASK_NOT_FOUND");
  }
  if (task.reporterId !== userId) {
    throw new Error("SUBMISSION_EDIT_DENIED");
  }
  if (task.rejectionPermanent) {
    throw new Error("SUBMISSION_PERMANENTLY_REJECTED");
  }
  if (task.approvalStatus === ApprovalStatus.APPROVED) {
    throw new Error("SUBMISSION_NOT_EDITABLE");
  }

  const approverIds = await getOrganizationApproverIds(task.project.organizationId, userId);
  return prisma.$transaction(async (transaction) => {
    const updatedTask = await transaction.task.update({
      where: { id: task.id },
      data: {
        ...parsed,
        approvalStatus: ApprovalStatus.PENDING,
        approvedByUserId: null,
        approvedAt: null,
        rejectionReason: null,
        rejectionPermanent: false,
      },
    });

    await transaction.activityLog.create({
      data: {
        organizationId: task.project.organizationId,
        projectId: task.projectId,
        taskId: task.id,
        actorUserId: userId,
        actionType: "TASK_UPDATED",
        actionDetail: JSON.stringify({ resubmitted: task.approvalStatus === ApprovalStatus.REJECTED }),
      },
    });

    if (approverIds.length > 0) {
      await transaction.notification.createMany({
        data: approverIds.map((recipientUserId) => ({
          recipientUserId,
          organizationId: task.project.organizationId,
          type: "TASK_APPROVAL_REQUESTED" as const,
          entityType: "TASK",
          entityId: task.id,
          message: `${updatedTask.title} was resubmitted for approval`,
        })),
      });
    }

    return updatedTask;
  });
}
