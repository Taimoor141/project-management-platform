import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/auth";
import { getUserWorkspaceRole, listOrganizationProjects, listUserOrganizations } from "@/server/organizations";
import { WorkspaceHeader } from "../components/workspace-header";

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const organizations = await listUserOrganizations(session.user.id);
  const role = await getUserWorkspaceRole(session.user.id);
  const projects = (
    await Promise.all(organizations.map((organization) => listOrganizationProjects(session.user.id, organization.id)))
  ).flat();

  return (
    <main className="app-page">
      <div className="app-container">
        <WorkspaceHeader userName={session.user.name} role={role} organizationName={session.user.organizationName} />
        <div className="page-heading">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h1 className="page-title">Projects</h1>
            <p className="page-description">A shared view of active projects across your organizations.</p>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state md:col-span-3">
            No active projects are available yet.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {projects.map((project) => (
              <Link href={`/projects/${project.id}`} key={project.id} className="surface block p-5 transition hover:-translate-y-0.5 hover:border-[var(--brand)]">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-xl font-semibold">{project.name}</h2>
                  <span className="rounded-md bg-[var(--surface-muted)] px-2 py-1 font-mono text-xs font-medium text-[var(--brand)]">{project.key}</span>
                </div>
                <p className="text-sm capitalize text-neutral-500">{project.status.toLowerCase()}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
