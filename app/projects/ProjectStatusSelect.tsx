"use client";

import { useRef } from "react";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/format";
import { setProjectStatus } from "./actions";

export default function ProjectStatusSelect({
  id,
  status,
}: {
  id: number;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={setProjectStatus} ref={formRef}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-brand-500"
      >
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PROJECT_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
