import { Icon } from "./icons";
import { toggleShared } from "../share/actions";

// Botão para compartilhar/tornar privado um registro. Só aparece para quem
// pode editar (dono ou admin). Verde = compartilhado com a equipe.
export function ShareToggle({
  entity,
  id,
  shared,
  canToggle,
}: {
  entity: string;
  id: number;
  shared: boolean;
  canToggle: boolean;
}) {
  // Quem não pode alternar (vê um registro compartilhado de outro) só vê o selo.
  if (!canToggle) {
    return shared ? (
      <span className="inline-flex items-center rounded-md px-1.5 py-1 text-green-600" title="Compartilhado pela equipe">
        <Icon name="share" size={14} />
      </span>
    ) : null;
  }

  return (
    <form action={toggleShared}>
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="shared" value={(!shared).toString()} />
      <button
        className={`inline-flex items-center rounded-md px-1.5 py-1 transition-colors ${
          shared
            ? "bg-green-100 text-green-700 hover:bg-green-200"
            : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        }`}
        title={shared ? "Compartilhado — clique para tornar privado" : "Compartilhar com a equipe"}
      >
        <Icon name="share" size={14} />
      </button>
    </form>
  );
}
