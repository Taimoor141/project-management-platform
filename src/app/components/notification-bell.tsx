"use client";

import { useEffect, useState } from "react";

type Notification = { id: string; message: string; isRead: boolean; createdAt: string };

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  async function refresh() {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (response.ok) setNotifications((await response.json()).notifications ?? []);
  }

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  async function markRead(id: string) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: id }) });
    setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, isRead: true } : notification));
  }

  const unread = notifications.filter((notification) => !notification.isRead).length;

  return (
    <div className="relative">
      <button type="button" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-lg transition hover:border-[var(--brand)]">
        <span aria-hidden="true" className="bell-mark" />
        {unread > 0 ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-white">{unread}</span> : null}
      </button>
      {open ? (
        <div className="surface absolute right-0 z-30 mt-2 w-80 overflow-hidden animate-fade">
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <span className="text-xs font-medium text-[var(--brand)]">{unread} unread</span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? <p className="p-5 text-sm text-neutral-500">You are all caught up.</p> : null}
            {notifications.map((notification) => (
              <button key={notification.id} type="button" onClick={() => markRead(notification.id)} className={`block w-full border-b border-[var(--line)] px-4 py-3 text-left text-sm hover:bg-[var(--surface-muted)] ${notification.isRead ? "text-neutral-500" : "font-medium text-[var(--foreground)]"}`}>
                <span className="block">{notification.message}</span>
                <span className="mt-1 block text-xs text-neutral-400">{new Date(notification.createdAt).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
