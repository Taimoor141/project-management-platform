import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserWorkspaceRole } from "@/server/organizations";
import { listProjectTasks } from "@/server/tasks";
import { TaskCreateForm } from "./task-create-form";
import { WorkspaceHeader } from "../../components/workspace-header";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { projectId } = await params;
  const role = await getUserWorkspaceRole(session.user.id);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, key: true, status: true, organization: { select: { name: true } } },
  });

  if (!project) {
    notFound();
  }

  let tasks;
  try {
    tasks = await listProjectTasks(session.user.id, projectId);
  } catch {
    notFound();
  }

  return (
    <main className="app-page">
      <div className="app-container">
        <WorkspaceHeader userName={session.user.name} role={role} organizationName={session.user.organizationName} />
        <section className="page-heading">
          <p className="eyebrow">{project.organization.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="page-title mt-0">{project.name}</h1>
            <span className="rounded-md bg-[var(--surface-muted)] px-2 py-1 font-mono text-xs font-medium text-[var(--brand)]">{project.key}</span>
          </div>
          <p className="page-description capitalize">{project.status.toLowerCase()} project</p>
        </section>

        <section className="surface p-6">
          <h2 className="text-lg font-semibold">Add a task</h2>
          <TaskCreateForm projectId={project.id} />
        </section>

        <section className="surface mt-5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tasks</h2>
            <span className="text-xs text-neutral-500">{tasks.length} active</span>
          </div>
          {tasks.length === 0 ? (
            <p className="empty-copy mt-5">This project has no active tasks yet.</p>
          ) : (
            <div className="mt-3 divide-y divide-[var(--line)]">
              {tasks.map((task) => (
                <article key={task.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div>
                    <h3 className="font-medium">{task.title}</h3>
                    <p className="mt-1 text-xs capitalize text-neutral-500">
                      {task.status.replaceAll("_", " ")} · {task.priority}
                    </p>
                  </div>
                  <p className="text-sm text-neutral-600">{task.assignee?.name ?? "Unassigned"}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
