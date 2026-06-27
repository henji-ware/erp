"use client";

import { useRef } from "react";
import { RENTAL_STATUSES, RENTAL_STATUS_LABELS } from "@/lib/format";
import { setRentalStatus } from "./actions";

export default function RentalStatusSelect({
  id,
  status,
}: {
  id: number;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={setRentalStatus} ref={formRef}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-brand-500"
      >
        {RENTAL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {RENTAL_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
