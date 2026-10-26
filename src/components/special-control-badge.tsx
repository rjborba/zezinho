export function SpecialControlBadge({ required, className }: { required: boolean; className?: string }) {
  if (!required) return null;

  return <span className={`special-control-badge${className ? ` ${className}` : ""}`}>Controle especial</span>;
}
