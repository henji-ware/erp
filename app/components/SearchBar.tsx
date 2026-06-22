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
    <form method="get" className="relative w-full max-w-xs">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <Icon name="search" size={16} />
      </span>
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="input pl-9"
        aria-label="Pesquisar"
      />
    </form>
  );
}
