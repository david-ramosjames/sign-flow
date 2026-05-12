import type { SigningRequestStatus } from "@/types/models";

const styles: Record<SigningRequestStatus, string> = {
  Draft: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
  Sent: "bg-sky-50 text-sky-900 ring-1 ring-sky-200",
  Viewed: "bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200",
  Signed: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200",
  Completed: "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-300",
  Declined: "bg-rose-50 text-rose-900 ring-1 ring-rose-200",
  Expired: "bg-amber-50 text-amber-950 ring-1 ring-amber-200",
  Failed: "bg-red-50 text-red-900 ring-1 ring-red-200",
};

export function StatusChip({ status }: { status: SigningRequestStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>{status}</span>;
}
