import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { getUserWorkspaceRole, listUserOrganizations } from "@/server/organizations";
import { OrganizationCreateForm } from "./organization-create-form";
import { WorkspaceHeader } from "../components/workspace-header";

export default async function OrganizationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const organizations = await listUserOrganizations(session.user.id);
  const role = await getUserWorkspaceRole(session.user.id);

  return (
    <main className="app-page">
      <div className="app-container">
        <WorkspaceHeader userName={session.user.name} role={role} organizationName={session.user.organizationName} />
        <div className="page-heading">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1 className="page-title">Organizations</h1>
            <p className="page-description">Manage the teams and workspaces you belong to.</p>
          </div>
        </div>

        <OrganizationCreateForm />

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {organizations.length === 0 ? (
            <div className="empty-state md:col-span-2">
              You do not belong to an organization yet.
            </div>
          ) : (
            organizations.map((organization) => (
              <article key={organization.id} className="surface p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-xl font-semibold">{organization.name}</h2>
                  <span className="status-chip">
                    {organization.members[0]?.role ?? "Member"}
                  </span>
                </div>
                <p className="font-mono text-xs text-neutral-500">/{organization.slug}</p>
                <p className="mt-4 text-sm text-neutral-500">
                  {organization._count.members} members · {organization._count.projects} projects
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
