"use client";

import { useState } from "react";

type Metric = {
  label: string;
  value: number;
  detail: string;
};

export function DashboardMetrics({ metrics }: { metrics: Metric[] }) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const selected = metrics.find((metric) => metric.label === selectedLabel) ?? metrics[0];

  return (
    <section className="mt-8" aria-label="Workspace metrics">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric, index) => {
          const selectedMetric = metric.label === selectedLabel;
          return (
            <button
              type="button"
              key={metric.label}
              onClick={() => setSelectedLabel(metric.label)}
              className={`surface animate-rise group p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                selectedMetric ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/10" : ""
              }`}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span className="flex items-center justify-between gap-3 text-sm text-neutral-600">
                {metric.label}
                <span className={`h-2 w-2 rounded-full transition ${selectedMetric ? "bg-[var(--brand)]" : "bg-neutral-200 group-hover:bg-lime-400"}`} />
              </span>
              <span className="mt-3 block text-3xl font-semibold text-[var(--foreground)]">{metric.value}</span>
            </button>
          );
        })}
      </div>

      {selectedLabel && selected ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[var(--foreground)]/30 px-6 backdrop-blur-sm animate-fade" role="dialog" aria-modal="true" aria-label={`${selected.label} details`}>
          <div className="surface w-full max-w-lg animate-pop p-7">
            <div className="flex items-start justify-between gap-6">
              <div><p className="eyebrow">Workspace insight</p><h2 className="mt-2 text-2xl font-semibold">{selected.label}</h2></div>
              <button type="button" onClick={() => setSelectedLabel(null)} className="rounded-lg px-2 py-1 text-neutral-500 hover:bg-neutral-100" aria-label="Close metric details">X</button>
            </div>
            <p className="mt-8 text-6xl font-semibold">{selected.value}</p>
            <p className="mt-3 text-sm leading-6 text-neutral-600">{selected.detail}</p>
            <div className="mt-8 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full w-2/3 rounded-full bg-[var(--brand)] animate-grow" /></div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
