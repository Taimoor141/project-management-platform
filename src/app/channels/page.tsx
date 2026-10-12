import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { listAudioChannels } from "@/server/audio";
import { getUserWorkspaceRole } from "@/server/organizations";
import { WorkspaceHeader } from "../components/workspace-header";
import { ChannelCreateForm } from "./channel-create-form";
import { ChannelCard } from "./channel-card";

export default async function ChannelsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const [channels, role] = await Promise.all([listAudioChannels(session.user.id), getUserWorkspaceRole(session.user.id)]);
  const canManage = role === "OWNER" || role === "ADMIN";

  return (
    <main className="app-page">
      <div className="app-container">
        <WorkspaceHeader userName={session.user.name} role={role} organizationName={session.user.organizationName} />
        <section className="page-heading">
          <p className="eyebrow">Team communication</p>
          <h1 className="page-title">Channels</h1>
          <p className="page-description max-w-2xl">Focused text and voice rooms for your teams and projects.</p>
        </section>

        {canManage ? <ChannelCreateForm /> : null}
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {channels.length === 0 ? <div className="empty-state md:col-span-2">No channels have been created for your organizations yet.</div> : null}
          {channels.map((channel) => <ChannelCard key={channel.id} channel={channel} canManage={canManage} />)}
        </div>
      </div>
    </main>
  );
}
