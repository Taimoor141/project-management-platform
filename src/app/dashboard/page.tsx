import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/auth";
import { listPendingApprovals } from "@/server/approvals";
import { getUserWorkspaceRole } from "@/server/organizations";
import { getDashboardSummary } from "@/server/tasks";
import { ApprovalActions } from "./approval-actions";
import { DashboardMetrics } from "./dashboard-metrics";
import { WorkspaceHeader } from "../components/workspace-header";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const summary = await getDashboardSummary(session.user.id);
  const pendingApprovals = await listPendingApprovals(session.user.id);
  const role = await getUserWorkspaceRole(session.user.id);

  return (
    <main className="app-page">
      <div className="app-container">
        <WorkspaceHeader userName={session.user.name} role={role} organizationName={session.user.organizationName} />
        <section className="page-heading dashboard-heading">
          <div>
            <p className="eyebrow">Workspace overview</p>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-description">A clear view of delivery, team activity, and what needs attention.</p>
          </div>
          <Link href="/projects" className="btn-secondary">View projects <span aria-hidden="true">→</span></Link>
        </section>

        <DashboardMetrics
          metrics={[
            { label: "Projects", value: summary.projects, detail: "Active projects across your organizations." },
            { label: "Tasks", value: summary.tasks, detail: "Approved active tasks currently in your workspace." },
            { label: "In Progress", value: summary.inProgress, detail: "Tasks actively moving through delivery right now." },
            { label: "Overdue", value: summary.overdue, detail: "Open tasks past their due date." },
            { label: "Unread Notifications", value: summary.unreadNotifications, detail: "Updates waiting for your attention." },
          ]}
        />

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Delivery pulse</p>
                <h2 className="mt-2 text-xl font-semibold">Work in motion</h2>
              </div>
              <span className="status-chip">Live</span>
            </div>
            <div className="mt-6 grid divide-y divide-[var(--line)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="py-3 sm:px-4 sm:py-1"><p className="text-xs text-neutral-500">Active work</p><p className="mt-2 text-3xl font-semibold">{summary.inProgress}</p><p className="mt-1 text-xs text-neutral-500">In progress now</p></div>
              <div className="py-3 sm:px-4 sm:py-1"><p className="text-xs text-neutral-500">Overdue</p><p className="mt-2 text-3xl font-semibold text-[var(--danger)]">{summary.overdue}</p><p className="mt-1 text-xs text-neutral-500">Past due date</p></div>
              <div className="py-3 sm:px-4 sm:py-1"><p className="text-xs text-neutral-500">Unread updates</p><p className="mt-2 text-3xl font-semibold">{summary.unreadNotifications}</p><p className="mt-1 text-xs text-neutral-500">Awaiting attention</p></div>
            </div>
          </div>
          <div className="surface p-6">
            <p className="eyebrow">Shortcuts</p>
            <h2 className="mt-2 text-xl font-semibold">Go to work</h2>
            <div className="mt-4 divide-y divide-[var(--line)]">
              <Link href="/organizations" className="flex items-center justify-between py-3 text-sm font-medium hover:text-[var(--brand)]">Organizations <span aria-hidden="true">→</span></Link>
              <Link href="/projects" className="flex items-center justify-between py-3 text-sm font-medium hover:text-[var(--brand)]">Projects <span aria-hidden="true">→</span></Link>
              <Link href="/channels" className="flex items-center justify-between py-3 text-sm font-medium hover:text-[var(--brand)]">Team channels <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="surface p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent activity</h2>
              <span className="text-xs text-neutral-500">Last 8 events</span>
            </div>
            {summary.recentActivity.length === 0 ? <p className="empty-copy mt-5">Activity will appear here as your team starts working.</p> : (
              <div className="mt-3 divide-y divide-[var(--line)]">
                {summary.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="text-neutral-700">{activity.actor?.name ?? "A team member"} {activity.actionType.toLowerCase().replaceAll("_", " ")}</span>
                    <time className="shrink-0 text-xs text-neutral-500">{activity.createdAt.toLocaleDateString()}</time>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="surface p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <span className="text-xs text-neutral-500">{summary.unreadNotifications} unread</span>
            </div>
            {summary.recentNotifications.length === 0 ? <p className="empty-copy mt-5">You are all caught up.</p> : (
              <div className="mt-3 divide-y divide-[var(--line)]">
                {summary.recentNotifications.map((notification) => (
                  <div key={notification.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className={notification.isRead ? "text-neutral-500" : "font-medium text-[var(--foreground)]"}>{notification.message}</span>
                    <time className="shrink-0 text-xs text-neutral-500">{notification.createdAt.toLocaleDateString()}</time>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {pendingApprovals.projects.length > 0 || pendingApprovals.tasks.length > 0 ? (
          <section className="surface mt-5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Approval queue</h2>
              <span className="status-chip">
                {pendingApprovals.projects.length + pendingApprovals.tasks.length} waiting
              </span>
            </div>
            <div className="mt-4 divide-y divide-[var(--line)]">
              {pendingApprovals.projects.map((project) => (
                <div key={project.id} className="flex items-center justify-between gap-4 py-4 text-sm">
                  <span>Project {project.name} <span className="text-neutral-500">from {project.createdBy.name}</span></span>
                  <ApprovalActions type="project" id={project.id} />
                </div>
              ))}
              {pendingApprovals.tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-4 py-4 text-sm">
                  <span>Task {task.title} <span className="text-neutral-500">from {task.reporter.name} in {task.project.name}</span></span>
                  <ApprovalActions type="task" id={task.id} />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
