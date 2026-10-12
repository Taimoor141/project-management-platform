import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { getUserWorkspaceRole, listManageableOrganizations } from "@/server/organizations";
import { WorkspaceHeader } from "../components/workspace-header";
import { TeamManager } from "./team-manager";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const role = await getUserWorkspaceRole(session.user.id);
  const organizations = await listManageableOrganizations(session.user.id);
  if (organizations.length === 0) redirect("/dashboard");

  return (
    <main className="app-page">
      <div className="app-container">
        <WorkspaceHeader userName={session.user.name} role={role} organizationName={session.user.organizationName} />
        <section className="page-heading">
          <p className="eyebrow">Workspace administration</p>
          <h1 className="page-title">Team</h1>
          <p className="page-description">Create employee and administrator accounts for your organization.</p>
        </section>
        <TeamManager
          organizations={organizations.map((organization) => ({
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            accessCode: organization.accessCode,
            members: organization.members.map((member) => ({
              id: member.id,
              role: member.role,
              joinedAt: member.joinedAt.toISOString(),
              user: member.user,
            })),
          }))}
        />
      </div>
    </main>
  );
}