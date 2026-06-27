"use client";

import { useRef } from "react";
import { MAINTENANCE_STATUSES, MAINTENANCE_STATUS_LABELS } from "@/lib/format";
import { setMaintenanceStatus } from "./actions";

export default function MaintenanceStatusSelect({
  id,
  status,
}: {
  id: number;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={setMaintenanceStatus} ref={formRef}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-brand-500"
      >
        {MAINTENANCE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {MAINTENANCE_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
