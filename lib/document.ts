// Validação e formatação de CPF/CNPJ (dígitos verificadores oficiais).

export function onlyDigits(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const d = (sum * 10) % 11;
    return d === 10 ? 0 : d;
  };
  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]);
}

export function isValidCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const check = (len: number) => {
    // Pesos: começam em 5 (CNPJ base) ou 6 (com o 1º dígito) e caem até 2.
    let pos = len - 7;
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += Number(cnpj[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const d = sum % 11;
    return d < 2 ? 0 : 11 - d;
  };
  return check(12) === Number(cnpj[12]) && check(13) === Number(cnpj[13]);
}

// Aceita CPF (11) ou CNPJ (14). Vazio é considerado válido (campo opcional).
export function isValidDocument(value: string | null | undefined): boolean {
  const d = onlyDigits(String(value ?? ""));
  if (!d) return true;
  if (d.length === 11) return isValidCPF(d);
  if (d.length === 14) return isValidCNPJ(d);
  return false;
}

// Formata para exibição: 000.000.000-00 ou 00.000.000/0000-00.
export function formatDocument(value: string | null | undefined): string {
  const d = onlyDigits(String(value ?? ""));
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return String(value ?? "");
}

// Normaliza para salvar: guarda formatado quando válido, senão o texto original.
export function normalizeDocument(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const d = onlyDigits(raw);
  return d.length === 11 || d.length === 14 ? formatDocument(d) : raw;
}
