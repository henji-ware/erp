import { NextRequest } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getReportData, parseRange } from "@/lib/reports";

// Exporta relatórios em CSV (separador ";" + BOM => abre direto no Excel pt-BR).
export async function GET(req: NextRequest) {
  // Mesma restrição da página /reports: os dados são consolidados da empresa
  // inteira, sem escopo por dono.
  if (!isAdmin(await getCurrentUser())) {
    return new Response("Sem permissão", { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") ?? "abc";
  const range = parseRange({
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });
  const data = await getReportData(range);

  let rows: (string | number)[][] = [];
  let filename = "relatorio.csv";

  if (type === "customers") {
    filename = "clientes.csv";
    rows = [
      ["Cliente", "Pedidos", "Faturamento"],
      ...data.topCustomers.map((c) => [c.name, c.orders, brl(c.revenue)]),
    ];
  } else {
    filename = "curva-abc.csv";
    rows = [
      ["Produto", "SKU", "Qtd", "Faturamento", "% total", "% acumulado", "Classe"],
      ...data.abc.map((p) => [
        p.name,
        p.sku,
        p.qty,
        brl(p.revenue),
        p.share.toFixed(1) + "%",
        p.cumPct.toFixed(1) + "%",
        p.cls,
      ]),
    ];
  }

  const csv = rows.map((r) => r.map(cell).join(";")).join("\r\n");
  const body = "﻿" + csv; // BOM

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function cell(v: string | number): string {
  let s = String(v);
  // Nomes de cliente/produto começando com = + - @ seriam interpretados como
  // fórmula ao abrir no Excel; o apóstrofo força texto.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function brl(n: number): string {
  return n.toFixed(2).replace(".", ",");
}
