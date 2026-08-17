"use client";

import React from "react";

/**
 * Renderizador de Markdown enxuto para as respostas da IA.
 *
 * Antes o texto do modelo era mostrado cru, então "**negrito**", listas e
 * blocos de código apareciam com os asteriscos e as crases na tela.
 *
 * Só monta elementos React — nada de dangerouslySetInnerHTML. A saída do modelo
 * pode conter dados de clientes e conteúdo que veio de fora do sistema; injetar
 * isso como HTML seria uma porta aberta para XSS.
 */

type Inline = string | React.ReactElement;

/** Aplica `código`, **negrito**, *itálico* e [texto](url) dentro de uma linha. */
function renderInline(text: string, keyPrefix: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-i${i++}`;

    if (token.startsWith("`")) {
      out.push(
        // Neutro de propósito: a cor de destaque do tema (âmbar no DRR) sobre
        // cinza-claro fica com contraste baixo demais para texto.
        <code key={key} className="px-1 py-0.5 rounded bg-slate-100 text-[0.92em] font-mono text-slate-800">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      out.push(
        <strong key={key} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("[")) {
      out.push(
        <a
          key={key}
          href={match[7]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-brand-600 hover:text-brand-700"
        >
          {match[6]}
        </a>
      );
    } else {
      out.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out.length > 0 ? out : [text];
}

export function RichText({ text }: { text: string }) {
  const blocks: React.ReactElement[] = [];
  const lines = text.split("\n");

  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bloco de código ```
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        body.push(lines[i]);
        i++;
      }
      i++; // fecha
      blocks.push(
        <pre
          key={`b${key++}`}
          className="my-2 p-2.5 rounded-lg bg-slate-900 text-slate-100 overflow-x-auto text-[11px] leading-relaxed"
        >
          {lang && <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-1">{lang}</div>}
          <code className="font-mono whitespace-pre">{body.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Títulos #, ##, ###
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      blocks.push(
        <p
          key={`b${key++}`}
          className={`mt-3 first:mt-0 mb-1 font-bold text-slate-900 ${
            level <= 2 ? "text-[1.08em]" : "text-[1em]"
          }`}
        >
          {renderInline(heading[2], `h${key}`)}
        </p>
      );
      i++;
      continue;
    }

    // Régua ---
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push(<hr key={`b${key++}`} className="my-2.5 border-slate-200" />);
      i++;
      continue;
    }

    // Lista com marcadores
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`b${key++}`} className="my-1.5 space-y-1 pl-4 list-disc marker:text-slate-400">
          {items.map((it, n) => (
            <li key={n}>{renderInline(it, `ul${key}-${n}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Lista numerada
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={`b${key++}`} className="my-1.5 space-y-1 pl-5 list-decimal marker:text-slate-400">
          {items.map((it, n) => (
            <li key={n}>{renderInline(it, `ol${key}-${n}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Linha em branco
    if (!line.trim()) {
      i++;
      continue;
    }

    // Parágrafo: junta as linhas seguidas até a próxima quebra/estrutura.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^#{1,4}\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith("```")
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`b${key++}`} className="my-1.5 first:mt-0 last:mb-0 whitespace-pre-wrap">
        {renderInline(para.join("\n"), `p${key}`)}
      </p>
    );
  }

  return <div className="text-[12px] leading-relaxed">{blocks}</div>;
}
