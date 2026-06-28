"use client";

import { useState } from "react";
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  LEAD_LOSS_REASONS,
  LEAD_LOSS_REASON_LABELS,
} from "@/lib/format";

// Etapa do orçamento + campos de "motivo da perda", que só aparecem quando
// a etapa selecionada é "Perdido".
export default function LeadStageLossFields({
  stage,
  lossReason,
  lossNote,
}: {
  stage: string;
  lossReason: string | null;
  lossNote: string | null;
}) {
  const [current, setCurrent] = useState(stage);

  return (
    <>
      <div>
        <label className="label">Etapa</label>
        <select
          name="stage"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="input"
        >
          {LEAD_STAGES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {current === "LOST" && (
        <div className="space-y-3 rounded-lg border border-red-100 bg-red-50/40 p-3">
          <div>
            <label className="label">Motivo da perda</label>
            <select name="lossReason" defaultValue={lossReason ?? ""} className="input">
              <option value="">Selecione...</option>
              {LEAD_LOSS_REASONS.map((r) => (
                <option key={r} value={r}>
                  {LEAD_LOSS_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Observação (opcional)</label>
            <textarea
              name="lossNote"
              rows={2}
              defaultValue={lossNote ?? ""}
              className="input"
              placeholder="Detalhe o que aconteceu..."
            />
          </div>
        </div>
      )}
    </>
  );
}
