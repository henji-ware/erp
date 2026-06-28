// Selo "adicionado por <nome>" — ajuda admins a localizar quem criou o registro.
export function OwnerTag({ name }: { name?: string }) {
  if (!name) return null;
  return <span className="text-xs text-slate-400"> · por {name}</span>;
}
