"use client";

import { FormEvent, useState } from "react";

type MemberRole = "OWNER" | "ADMIN" | "MEMBER";
type Organization = {
  id: string;
  name: string;
  slug: string;
  accessCode: string;
  members: { id: string; role: MemberRole; joinedAt: string; user: { id: string; name: string; email: string } }[];
};

export function TeamManager({ organizations: initialOrganizations }: { organizations: Organization[] }) {
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [organizationId, setOrganizationId] = useState(initialOrganizations[0]?.id ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedOrganization = organizations.find((organization) => organization.id === organizationId);

  async function copyOrganizationCode() {
    if (!selectedOrganization) return;
    await navigator.clipboard.writeText(selectedOrganization.accessCode);
    setCodeCopied(true);
    window.setTimeout(() => setCodeCopied(false), 1600);
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/team/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, name, email, password, role }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setError(result?.error === "EMAIL_ALREADY_REGISTERED" ? "An account already uses that email." : result?.error === "FORBIDDEN" ? "You cannot manage this organization." : "Unable to create the account.");
        return;
      }

      const account = result.account;
      setOrganizations((current) => current.map((organization) => organization.id === organizationId
        ? { ...organization, members: [...organization.members, { id: account.id, role: account.role, joinedAt: new Date().toISOString(), user: { id: account.id, name: account.name, email: account.email } }] }
        : organization));
      setName("");
      setEmail("");
      setPassword("");
      setRole("MEMBER");
      setMessage(`${account.name} was added to ${selectedOrganization?.name}.`);
    } catch {
      setError("Unable to reach the server. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="surface p-6">
        <div className="mb-5">
          <p className="eyebrow">New account</p>
          <h2 className="mt-2 text-lg font-semibold">Create team access</h2>
        </div>
        <form onSubmit={createAccount} className="space-y-4">
          <div>
            <label htmlFor="team-organization" className="mb-1.5 block text-sm font-medium">Organization</label>
            <select id="team-organization" required value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className="field w-full">
              {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
            </select>
          </div>
          <div className="access-code-panel">
            <div>
              <span className="access-code-label">Organization sign-in code</span>
              <code className="access-code-value">{selectedOrganization?.accessCode ?? "------"}</code>
            </div>
            <button type="button" onClick={() => void copyOrganizationCode()} disabled={!selectedOrganization} className="btn-secondary access-code-copy">
              {codeCopied ? "Copied" : "Copy code"}
            </button>
          </div>
          <div>
            <label htmlFor="team-name" className="mb-1.5 block text-sm font-medium">Full name</label>
            <input id="team-name" required minLength={2} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Sam Rivera" className="field w-full" />
          </div>
          <div>
            <label htmlFor="team-email" className="mb-1.5 block text-sm font-medium">Work email</label>
            <input id="team-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="sam@company.com" className="field w-full" />
          </div>
          <div>
            <label htmlFor="team-password" className="mb-1.5 block text-sm font-medium">Initial password</label>
            <input id="team-password" required minLength={12} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" className="field w-full" />
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Access level</legend>
            <div className="grid grid-cols-2 gap-2">
              <label className={`role-option ${role === "MEMBER" ? "role-option-selected" : ""}`}>
                <input type="radio" name="team-role" value="MEMBER" checked={role === "MEMBER"} onChange={() => setRole("MEMBER")} />
                <span><strong>Employee</strong><small>Standard workspace access</small></span>
              </label>
              <label className={`role-option ${role === "ADMIN" ? "role-option-selected" : ""}`}>
                <input type="radio" name="team-role" value="ADMIN" checked={role === "ADMIN"} onChange={() => setRole("ADMIN")} />
                <span><strong>Admin</strong><small>Manage team and channels</small></span>
              </label>
            </div>
          </fieldset>
          {error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}
          {message ? <p role="status" className="text-sm text-[var(--brand)]">{message}</p> : null}
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full disabled:opacity-50">{isSubmitting ? "Creating account..." : "Create account"}</button>
        </form>
      </section>

      <section className="surface min-w-0 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">People</p>
            <h2 className="mt-2 text-lg font-semibold">{selectedOrganization?.name ?? "Team members"}</h2>
          </div>
          <span className="text-xs text-neutral-500">{selectedOrganization?.members.length ?? 0} members</span>
        </div>
        <div className="mt-5 divide-y divide-[var(--line)]">
          {selectedOrganization?.members.map((member) => (
            <article key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="member-avatar" aria-hidden="true">{member.user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span>
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-medium">{member.user.name}</strong>
                  <span className="block truncate text-xs text-neutral-500">{member.user.email}</span>
                </span>
              </div>
              <span className={`member-role ${member.role === "MEMBER" ? "" : "member-role-admin"}`}>{member.role === "MEMBER" ? "Employee" : member.role === "OWNER" ? "Owner" : "Admin"}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}