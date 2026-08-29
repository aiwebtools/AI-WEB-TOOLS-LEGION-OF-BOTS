import { ExternalLink } from "lucide-react";

export default function MoreAiTools({ variant = "default", className = "" }) {
  const base =
    "inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider transition-colors duration-150";
  const styles = {
    default:
      "px-4 py-2 border border-matrix/50 text-matrix hover:bg-matrix hover:text-black rounded-sm box-glow",
    ghost: "px-3 py-1.5 text-matrix/80 hover:text-matrix",
    solid: "px-4 py-2 bg-matrix text-black hover:bg-matrix-dark rounded-sm font-bold",
  };
  return (
    <a
      href="https://aiwebtools.app"
      target="_blank"
      rel="noopener noreferrer"
      data-testid="more-ai-tools-btn"
      className={`${base} ${styles[variant]} ${className}`}
    >
      <span>&gt; More AI Tools_</span>
      <ExternalLink className="w-3.5 h-3.5" />
    </a>
  );
}
