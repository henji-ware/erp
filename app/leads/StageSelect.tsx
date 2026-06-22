"use client";

import { useRef } from "react";
import { LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/format";
import { updateLeadStage } from "./actions";

export default function StageSelect({
  id,
  stage,
}: {
  id: number;
  stage: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={updateLeadStage} ref={formRef}>
      <input type="hidden" name="id" value={id} />
      <select
        name="stage"
        defaultValue={stage}
        onChange={() => formRef.current?.requestSubmit()}
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-brand-500"
      >
        {LEAD_STAGES.map((s) => (
          <option key={s} value={s}>
            Mover para: {LEAD_STAGE_LABELS[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
