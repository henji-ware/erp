import { Icon, type IconName } from "../../components/icons";

/**
 * Bloco recolhível do editor de proposta.
 *
 * O formulário tem 31 campos. Empilhados, viravam uma parede de 240 linhas
 * onde achar "Condições de pagamento" exigia rolar procurando pelo rótulo.
 *
 * É `<details>` nativo de propósito, não abas: com abas só a aba ativa fica
 * montada, e como aqui tudo vive dentro de UM <form>, os campos escondidos
 * sumiriam do envio e o salvar apagaria metade da proposta. O `<details>`
 * mantém tudo no DOM — apenas oculto.
 */
export default function ProposalSection({
  title,
  hint,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** O que tem dentro, para achar a seção sem abrir uma por uma. */
  hint: string;
  icon: IconName;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="proposal-section">
      <summary>
        <span className="proposal-section-icon">
          <Icon name={icon} size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-800">{title}</span>
          <span className="block truncate text-xs text-slate-400">{hint}</span>
        </span>
        <span className="proposal-section-chevron shrink-0 text-slate-400">
          <Icon name="chevronRight" size={16} />
        </span>
      </summary>
      <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
        {children}
      </div>
    </details>
  );
}
