"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationCode, setOrganizationCode] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      organizationCode: organizationCode.trim(),
      redirect: false,
      callbackUrl: "/dashboard",
    });

    if (!result || result.error) {
      setError("Check your email, password, and organization code.");
      return;
    }

    window.location.assign(result.url ?? "/dashboard");
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <aside className="login-aside">
          <div>
            <div className="brand-glyph">P</div>
            <p className="eyebrow mt-8 text-[#d8e66d]">ProjectFlow workspace</p>
            <h2 className="mt-4 max-w-xs text-4xl font-semibold leading-tight">Good work starts with a clear view.</h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/70">
              Projects, people, and decisions, together in one considered workspace.
            </p>
          </div>
          <div className="login-aside-foot">
            <span className="status-chip">Workspace access</span>
            <p className="mt-4 text-xs text-white/55">Teams move forward, together.</p>
          </div>
        </aside>

        <div className="login-form-panel">
        <p className="eyebrow">Welcome back</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sign in to ProjectFlow</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Enter your details to continue to your workspace.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="login-email" className="mb-2 block text-sm font-medium">Email</label>
            <input
              id="login-email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field w-full"
              type="email"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-2 block text-sm font-medium">Password</label>
            <input
              id="login-password"
              required
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field w-full"
              type="password"
              placeholder="Enter your password"
            />
          </div>

          <div>
            <label htmlFor="organization-code" className="mb-2 block text-sm font-medium">6-digit organization code</label>
            <input
              id="organization-code"
              value={organizationCode}
              onChange={(event) => setOrganizationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="field w-full font-mono"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="000000"
              aria-describedby="organization-code-hint"
            />
            <p id="organization-code-hint" className="mt-1.5 text-xs text-neutral-500">Use the code shared by your organization administrator.</p>
          </div>

          {error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}

          <button
            type="submit"
            className="btn-primary w-full"
          >
            Sign in
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-neutral-500">Need access? Contact your workspace administrator.</p>
        </div>
      </div>
    </main>
  );
}
