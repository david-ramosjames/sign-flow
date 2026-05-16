import type { SigningStatus } from "@/types/models";

const styles: Record<SigningStatus, string> = {
  draft: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
  sent: "bg-sky-50 text-sky-900 ring-1 ring-sky-200",
  viewed: "bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200",
  completed: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200",
  signed: "bg-amber-50 text-amber-950 ring-1 ring-[color:var(--brand-gold)]",
  expired: "bg-amber-50 text-amber-950 ring-1 ring-amber-200",
  failed: "bg-red-50 text-red-900 ring-1 ring-red-200",
};

export function StatusChip({ status }: { status: SigningStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}
