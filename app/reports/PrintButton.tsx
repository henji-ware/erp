"use client";

import { Icon } from "../components/icons";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-ghost no-print">
      <Icon name="print" size={16} /> Imprimir / PDF
    </button>
  );
}
