// Re-monta a cada navegação => dispara a animação de entrada da página.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
