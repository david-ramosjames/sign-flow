import Link from "next/link";
import { AppShell } from "@/components/relay/app-shell";

const links = [
  { href: "/admin/settings", label: "Integrations" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/reminders", label: "Reminder schedules" },
  { href: "/admin/messages", label: "Message templates" },
  { href: "/admin/staff", label: "Staff users" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Administration</div>
          <nav className="mt-3 flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 border-t border-[color:var(--border)] pt-4 text-xs text-slate-600">
            Secrets stay in environment variables. These pages store operational configuration in Firestore (or mock store).
          </div>
        </aside>
        <div>{children}</div>
      </div>
    </AppShell>
  );
}
