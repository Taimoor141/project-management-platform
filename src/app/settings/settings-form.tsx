"use client";

import { FormEvent, useState } from "react";

export function SettingsForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSaving(true);
    const response = await fetch("/api/account/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setIsSaving(false);
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error === "CURRENT_PASSWORD_INVALID" ? "Current password is incorrect." : "Password must be at least 12 characters.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setMessage("Password updated successfully.");
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5 border-t border-neutral-200 pt-6">
      <h2 className="text-lg font-semibold">Change password</h2>
      <input required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Current password" className="field w-full" />
      <input required minLength={12} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password (12+ characters)" className="field w-full" />
      {error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}
      {message ? <p role="status" className="text-sm text-[var(--brand)]">{message}</p> : null}
      <button disabled={isSaving} className="btn-primary disabled:opacity-50">{isSaving ? "Saving..." : "Update password"}</button>
    </form>
  );
}
