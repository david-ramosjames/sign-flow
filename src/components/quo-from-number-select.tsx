"use client";

import type { QuoPhoneNumberOption } from "@/types/models";

function labelFor(n: QuoPhoneNumberOption): string {
  const name = n.name?.trim();
  if (name) return `${name} (${n.number})`;
  return n.number;
}

/** Dropdown to pick which Quo number an SMS is sent from. Hidden when no numbers are imported. */
export function QuoFromNumberSelect({
  numbers,
  value,
  onChange,
  disabled,
}: {
  numbers: QuoPhoneNumberOption[];
  value: string;
  onChange: (phoneNumberId: string) => void;
  disabled?: boolean;
}) {
  if (numbers.length === 0) return null;

  return (
    <div>
      <label className="text-sm font-medium text-slate-900">Send SMS from</label>
      <p className="mt-0.5 text-xs text-slate-500">Defaults to this firm&apos;s setting; change for this send only.</p>
      <select
        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {numbers.map((n) => (
          <option key={n.id} value={n.id}>
            {labelFor(n)}
          </option>
        ))}
      </select>
    </div>
  );
}
