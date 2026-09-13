import { Icon } from "./icons";

// Barra de pesquisa simples (GET) — recarrega a página com ?q=...
export function SearchBar({
  placeholder = "Pesquisar...",
  defaultValue = "",
}: {
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <form method="get" role="search" className="flex w-full max-w-md items-center gap-2">
      <div className="relative min-w-0 flex-1">
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <Icon name="search" size={16} />
      </span>
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="input pl-9"
        aria-label={placeholder}
      />
      </div>
      <button type="submit" className="btn-secondary shrink-0">Buscar</button>
    </form>
  );
}
