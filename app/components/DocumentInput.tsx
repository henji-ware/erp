"use client";

import { useState } from "react";
import { formatDocument, isValidDocument, onlyDigits } from "@/lib/document";

// Campo de CPF/CNPJ com máscara automática e aviso quando o documento é
// inválido (dígito verificador). Vazio é aceito — o campo é opcional.
export default function DocumentInput({
  name = "document",
  defaultValue = "",
  label = "CPF / CNPJ",
  required = false,
}: {
  name?: string;
  defaultValue?: string;
  label?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(formatDocument(defaultValue));
  const digits = onlyDigits(value);
  // Só acusa erro quando o tamanho já bate com CPF/CNPJ (evita alarme enquanto digita).
  const complete = digits.length === 11 || digits.length === 14;
  const invalid = complete && !isValidDocument(digits);

  return (
    <div>
      <label className="label">{label}</label>
      <input
        name={name}
        required={required}
        value={value}
        onChange={(e) => {
          const d = onlyDigits(e.target.value).slice(0, 14);
          setValue(d.length === 11 || d.length === 14 ? formatDocument(d) : d);
        }}
        inputMode="numeric"
        placeholder="000.000.000-00 ou 00.000.000/0000-00"
        className={`input ${invalid ? "border-red-400 focus:border-red-500" : ""}`}
      />
      {invalid && (
        <p className="mt-1 text-xs text-red-600">
          {digits.length === 11 ? "CPF inválido" : "CNPJ inválido"} — confira os números.
        </p>
      )}
    </div>
  );
}
