import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { getUserWorkspaceRole } from "@/server/organizations";
import { WorkspaceHeader } from "../components/workspace-header";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const role = await getUserWorkspaceRole(session.user.id);

  return (
    <main className="app-page">
      <div className="app-container">
        <WorkspaceHeader userName={session.user.name} role={role} organizationName={session.user.organizationName} />
        <section className="page-heading">
          <p className="eyebrow">Account</p>
          <h1 className="page-title">Settings</h1>
          <p className="page-description">Manage your account security and workspace preferences.</p>
        </section>
        <section className="surface max-w-2xl p-6 sm:p-8">
          <div>
            <h2 className="text-lg font-semibold">Security</h2>
            <p className="mt-1 text-sm text-neutral-500">Update your password to keep your account secure.</p>
          </div>
          <SettingsForm />
        </section>
      </div>
    </main>
  );
}
