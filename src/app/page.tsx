import Link from "next/link";

export default function Home() {
  return (
    <main className="marketing-page">
      <div className="marketing-container">
        <header className="marketing-nav">
          <Link href="/" className="brand-block" aria-label="ProjectFlow home">
            <span className="brand-glyph">P</span>
            <span>
              <span className="block text-sm font-semibold">ProjectFlow</span>
              <span className="block text-xs text-neutral-500">Team workspace</span>
            </span>
          </Link>
          <nav aria-label="Main navigation" className="marketing-links">
            <a href="#platform">Platform</a>
            <a href="#features">Capabilities</a>
            <a href="#security">Security</a>
            <Link href="/login" className="btn-secondary">Sign in</Link>
          </nav>
        </header>

        <section id="platform" className="marketing-hero">
          <div className="marketing-kicker"><span className="kicker-rule" /> Project management, with the team in view</div>
          <h1>ProjectFlow</h1>
          <div className="marketing-subhead">
            <p className="marketing-mantra">Turn plans into momentum.</p>
            <div>
              <p className="max-w-lg text-base leading-7 text-neutral-600">One clear place to align teams, move projects forward, and keep decisions close to the work.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/login" className="btn-primary">Open your workspace <span aria-hidden="true">→</span></Link>
                <a href="#features" className="btn-secondary">Explore the platform</a>
              </div>
            </div>
          </div>
        </section>

        <section className="product-preview" aria-label="ProjectFlow delivery board preview">
          <div className="preview-topbar">
            <div className="flex items-center gap-3">
              <span className="preview-mark">P</span>
              <div>
                <p className="text-xs text-white/55">Workspace / Product</p>
                <h2 className="mt-1 text-sm font-semibold text-white">Q3 launch</h2>
              </div>
            </div>
            <span className="preview-live"><span />On track</span>
          </div>
          <div className="preview-board">
            {[
              { title: "Up next", count: "02", tasks: [["Finalize onboarding flow", "Design", "ML"], ["Review launch checklist", "Operations", "AK"]] },
              { title: "In progress", count: "03", tasks: [["Workspace permissions", "Engineering", "JT"], ["Customer interviews", "Research", "SR"]] },
              { title: "In review", count: "01", tasks: [["Project overview", "Product", "ML"]] },
            ].map((column, columnIndex) => (
              <div key={column.title} className="preview-column">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-xs font-semibold text-white">{column.title}</h3>
                  <span className="font-mono text-[10px] text-white/45">{column.count}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {column.tasks.map(([task, team, initials], taskIndex) => (
                    <article key={task} className="preview-task">
                      <div className={`task-indicator task-indicator-${columnIndex + taskIndex}`} />
                      <p className="text-xs font-medium leading-5 text-white/90">{task}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[10px] text-white/45">{team}</span>
                        <span className="preview-avatar">{initials}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="preview-footer"><span>Project overview</span><span>12 tasks · 4 contributors · Updated just now</span></div>
        </section>

        <section id="features" className="feature-section">
          <div className="feature-intro">
            <p className="eyebrow">One workspace, less friction</p>
            <h2>Everything stays connected to the work.</h2>
          </div>
          <div className="feature-list">
            {[
              ["01", "Team-wide context", "Coordinate organizations, roles, and projects with a shared view of ownership."],
              ["02", "Clear delivery", "Track priorities, status, and approvals without losing sight of the next step."],
              ["03", "Conversation in place", "Bring text channels and live voice rooms closer to the projects they support."],
            ].map(([number, title, description]) => (
              <article key={number} className="feature-row">
                <span className="feature-number">{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="security" className="security-band">
          <div>
            <p className="eyebrow text-[#d8e66d]">Built for accountable teams</p>
            <h2>Work stays scoped to the right people.</h2>
          </div>
          <p>Role-aware access, protected routes, approvals, and an activity trail help keep each organization and project boundary clear.</p>
        </section>

        <footer className="marketing-footer">
          <span>ProjectFlow</span>
          <span>Team workspace</span>
        </footer>
      </div>
    </main>
  );
}
