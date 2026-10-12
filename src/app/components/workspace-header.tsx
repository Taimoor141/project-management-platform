"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "./account-menu";
import { NotificationBell } from "./notification-bell";
import { AudioRail } from "./audio-rail";

const tabs = [
  { href: "/dashboard", label: "Overview" },
  { href: "/organizations", label: "Organizations" },
  { href: "/projects", label: "Projects" },
];

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

export function WorkspaceHeader({ userName, role, organizationName }: { userName?: string | null; role?: string | null; organizationName?: string | null }) {
  const pathname = usePathname();
  const navigationTabs = role === "OWNER" || role === "ADMIN" ? [...tabs, { href: "/team", label: "Team" }] : tabs;

  return (
    <header className="workspace-header">
      <div className="brand-block">
        <div className="flex items-center gap-2">
          <AudioRail role={role} />
          <div className="brand-glyph">P</div>
        </div>
        <div>
          <p className="text-sm font-semibold">ProjectFlow</p>
          <p className="max-w-44 truncate text-xs text-neutral-500">{organizationName || "Team workspace"}</p>
        </div>
      </div>

      <nav aria-label="Workspace" className="workspace-nav">
        {navigationTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`nav-link ${
              isActive(pathname, tab.href) ? "nav-link-active" : ""
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="header-actions">
        <NotificationBell />
        <AccountMenu userName={userName} role={role} />
      </div>
    </header>
  );
}
