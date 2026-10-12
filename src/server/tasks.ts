import { ApprovalStatus, Role, TaskPriority, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAccessOrganization, getOrganizationApproverIds, getOrganizationMemberRole } from "./organizations";

export const createTaskSchema = z.object({
  projectId: z.string().min(1),
  reporterId: z.string().min(1),
  title: z.string().trim().min(2, "Task title must be at least 2 characters long").max(200),
  description: z.string().trim().max(5000).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export async function canAccessProject(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true, archivedAt: true },
  });

  if (!project || project.archivedAt) {
    return false;
  }

  return canAccessOrganization(userId, project.organizationId);
}

export async function listProjectTasks(userId: string, projectId: string) {
  if (!(await canAccessProject(userId, projectId))) {
    throw new Error("PROJECT_ACCESS_DENIED");
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
  const role = project ? await getOrganizationMemberRole(userId, project.organizationId) : null;
  const canReview = role === Role.OWNER || role === Role.ADMIN;

  return prisma.task.findMany({
    where: {
      projectId,
      archivedAt: null,
      ...(canReview ? {} : { OR: [{ approvalStatus: ApprovalStatus.APPROVED }, { reporterId: userId }] }),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true } },
      labels: { include: { label: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
}

export async function createTask(input: unknown) {
  const parsed = createTaskSchema.parse(input);
  const project = await prisma.project.findUnique({
    where: { id: parsed.projectId },
    select: { id: true, organizationId: true, name: true, archivedAt: true },
  });

  const reporterRole = project ? await getOrganizationMemberRole(parsed.reporterId, project.organizationId) : null;
  if (!project || project.archivedAt || !reporterRole) {
    throw new Error("PROJECT_ACCESS_DENIED");
  }

  if (parsed.assigneeId && !(await canAccessOrganization(parsed.assigneeId, project.organizationId))) {
    throw new Error("ASSIGNEE_NOT_IN_ORGANIZATION");
  }

  const isApprover = reporterRole === Role.OWNER || reporterRole === Role.ADMIN;
  const approvalStatus = isApprover ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING;
  const approverIds = isApprover ? [] : await getOrganizationApproverIds(project.organizationId, parsed.reporterId);

  const task = await prisma.$transaction(async (transaction) => {
    const createdTask = await transaction.task.create({
      data: {
        projectId: parsed.projectId,
        reporterId: parsed.reporterId,
        title: parsed.title,
        description: parsed.description,
        status: parsed.status ?? TaskStatus.BACKLOG,
        priority: parsed.priority ?? TaskPriority.MEDIUM,
        assigneeId: parsed.assigneeId,
        dueDate: parsed.dueDate,
        approvalStatus,
        approvedByUserId: isApprover ? parsed.reporterId : null,
        approvedAt: isApprover ? new Date() : null,
      },
    });

    await transaction.activityLog.create({
      data: {
        organizationId: project.organizationId,
        projectId: project.id,
        taskId: createdTask.id,
        actorUserId: parsed.reporterId,
        actionType: "TASK_CREATED",
        actionDetail: JSON.stringify({ title: createdTask.title, approvalStatus }),
      },
    });

    if (approverIds.length > 0) {
      await transaction.notification.createMany({
        data: approverIds.map((recipientUserId) => ({
          recipientUserId,
          organizationId: project.organizationId,
          type: "TASK_APPROVAL_REQUESTED" as const,
          entityType: "TASK",
          entityId: createdTask.id,
          message: `${createdTask.title} is waiting for approval`,
        })),
      });
    }

    if (parsed.assigneeId && parsed.assigneeId !== parsed.reporterId) {
      await transaction.notification.create({
        data: {
          recipientUserId: parsed.assigneeId,
          organizationId: project.organizationId,
          type: "TASK_ASSIGNED",
          entityType: "TASK",
          entityId: createdTask.id,
          message: `You were assigned to ${createdTask.title}`,
        },
      });
    }

    return createdTask;
  });

  return task;
}

export async function getDashboardSummary(userId: string) {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId, status: "ACTIVE", organization: { archivedAt: null } },
    select: { organizationId: true },
  });
  const organizationIds = memberships.map(({ organizationId }) => organizationId);

  if (organizationIds.length === 0) {
    return {
      projects: 0,
      tasks: 0,
      inProgress: 0,
      overdue: 0,
      unreadNotifications: 0,
      recentActivity: [],
      recentNotifications: [],
    };
  }

  const [projects, tasks, inProgress, overdue, unreadNotifications, recentNotifications, recentActivity] = await Promise.all([
    prisma.project.count({ where: { organizationId: { in: organizationIds }, archivedAt: null, approvalStatus: ApprovalStatus.APPROVED } }),
    prisma.task.count({ where: { project: { organizationId: { in: organizationIds } }, archivedAt: null, approvalStatus: ApprovalStatus.APPROVED } }),
    prisma.task.count({
      where: {
        project: { organizationId: { in: organizationIds } },
        archivedAt: null,
        approvalStatus: ApprovalStatus.APPROVED,
        status: "IN_PROGRESS",
      },
    }),
    prisma.task.count({
      where: {
        project: { organizationId: { in: organizationIds } },
        archivedAt: null,
        approvalStatus: ApprovalStatus.APPROVED,
        dueDate: { lt: new Date() },
        status: { not: "DONE" },
      },
    }),
    prisma.notification.count({ where: { recipientUserId: userId, isRead: false } }),
    prisma.notification.findMany({
      where: { recipientUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.activityLog.findMany({
      where: { organizationId: { in: organizationIds } },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return { projects, tasks, inProgress, overdue, unreadNotifications, recentActivity, recentNotifications };
}
