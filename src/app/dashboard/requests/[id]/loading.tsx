export default function SigningRequestDetailLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div>
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="mt-3 h-8 w-64 max-w-full rounded bg-slate-200" />
        <div className="mt-2 h-4 w-80 max-w-full rounded bg-slate-100" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm lg:col-span-2">
          <div className="h-4 w-16 rounded bg-slate-200" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="h-3 w-20 rounded bg-slate-100" />
                <div className="mt-2 h-4 w-32 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
          <div className="h-4 w-14 rounded bg-slate-200" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
        <div className="h-4 w-16 rounded bg-slate-200" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
