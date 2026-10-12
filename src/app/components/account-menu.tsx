"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

type PresenceMember = {
  user: { id: string; name: string; presenceStatus: "ONLINE" | "AWAY" | "OFFLINE" };
  role: "OWNER" | "ADMIN" | "MEMBER";
  organization: { id: string; name: string };
};

export function AccountMenu({ userName, role }: { userName?: string | null; role?: string | null }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [theme, setTheme] = useState<"light" | "dim" | "contrast">("light");
  const roleLabel = role === "OWNER" ? "Owner" : role === "ADMIN" ? "Admin" : "Employee";
  const initials = (userName || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("projectflow-theme");
    if (savedTheme === "dim" || savedTheme === "contrast") {
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
    }

    async function refreshPresence() {
      const response = await fetch("/api/presence", { cache: "no-store" });
      if (response.ok) {
        const result = await response.json();
        setMembers(result.members ?? []);
      }
    }

    void refreshPresence();
    const interval = window.setInterval(refreshPresence, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  function setSelectedTheme(nextTheme: "light" | "dim" | "contrast") {
    setTheme(nextTheme);
    window.localStorage.setItem("projectflow-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left transition hover:border-[var(--brand)]"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-semibold text-white">{initials}</div>
        <div className="min-w-0">
          <p className="max-w-32 truncate text-sm font-medium">{userName || "Workspace user"}</p>
          <p className="text-xs text-[var(--brand)]">{roleLabel} account</p>
        </div>
        <span className="text-neutral-400">{open ? "-" : "+"}</span>
      </button>

      {open ? (
        <div className="surface absolute right-0 z-20 mt-2 w-80 overflow-hidden animate-fade">
          <div className="border-b border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <p className="eyebrow">Signed in as</p>
            <p className="mt-1 font-medium">{userName || "Workspace user"}</p>
            <p className="text-sm text-neutral-500">{roleLabel} account</p>
          </div>
          <div className="p-2">
            <Link href="/settings" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-[var(--surface-muted)]">Settings</Link>
            <div className="rounded-lg px-3 py-2">
              <p className="text-sm font-medium">Theme</p>
              <div className="mt-2 flex gap-1">
                {(["light", "dim", "contrast"] as const).map((option) => (
                  <button key={option} type="button" aria-pressed={theme === option} onClick={() => setSelectedTheme(option)} className={`rounded-md px-2.5 py-1.5 text-xs capitalize ${theme === option ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-muted)] text-neutral-600 hover:bg-[var(--line)]"}`}>{option}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--line)] px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Online now</p>
              <span className="text-xs font-medium text-[var(--brand)]">{members.length}</span>
            </div>
            <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
              {members.length === 0 ? <p className="text-sm text-neutral-500">No teammates online yet.</p> : null}
              {members.map((member) => (
                <div key={`${member.organization.id}-${member.user.id}`} className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 rounded-full ${member.user.presenceStatus === "AWAY" ? "bg-amber-400" : "bg-emerald-600"}`} />
                  <span className="truncate text-neutral-700">{member.user.name}</span>
                  <span className="ml-auto text-xs text-neutral-400">{member.role === "MEMBER" ? "Employee" : member.role[0] + member.role.slice(1).toLowerCase()}</span>
                </div>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="w-full border-t border-[var(--line)] px-4 py-3 text-left text-sm font-medium text-[var(--danger)] hover:bg-red-50">Log out</button>
        </div>
      ) : null}
    </div>
  );
}
