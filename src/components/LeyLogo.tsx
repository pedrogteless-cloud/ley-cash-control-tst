/** Logo oficial da Ley (só "Ley", sem o descritivo). Navy sobre fundo claro, branco sobre azul-marinho. */
export function LeyLogo({ className = "h-8", branco = false }: { className?: string; branco?: boolean }) {
  return (
    <img
      src={branco ? "/ley-logo-branco.png" : "/ley-logo.png"}
      alt="Ley"
      className={`w-auto select-none ${className}`}
      draggable={false}
    />
  );
}
