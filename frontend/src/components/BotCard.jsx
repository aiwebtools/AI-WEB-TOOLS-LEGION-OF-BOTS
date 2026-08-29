import { Star, ArrowRight, ImageIcon, Terminal, FileText, Braces } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { iconFor } from "@/lib/icons";
import api from "@/lib/api";
import { useState } from "react";

const CAP_META = {
  image: { label: "Image", icon: ImageIcon },
  python: { label: "Python", icon: Terminal },
  document_generation: { label: "Docs", icon: FileText },
  coding: { label: "Code", icon: Braces },
  long_context: { label: "Long Context", icon: null },
  research: { label: "Research", icon: null },
};

export function CapabilityBadges({ capabilities = {}, limit = 4 }) {
  const active = Object.keys(CAP_META).filter((k) => capabilities[k]).slice(0, limit);
  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map((k) => {
        const Icon = CAP_META[k].icon;
        return (
          <span
            key={k}
            data-testid={`cap-badge-${k}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide border border-border text-matrix/80 bg-matrix/5 rounded-sm"
          >
            {Icon && <Icon className="w-3 h-3" />}
            {CAP_META[k].label}
          </span>
        );
      })}
    </div>
  );
}

export default function BotCard({ bot, onFavoriteChange, index = 0 }) {
  const navigate = useNavigate();
  const Icon = iconFor(bot.icon);
  const [fav, setFav] = useState(!!bot.is_favorite);
  const [busy, setBusy] = useState(false);

  const toggleFav = async (e) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (fav) { await api.delete(`/favorites/${bot.id}`); setFav(false); }
      else { await api.post(`/favorites/${bot.id}`); setFav(true); }
      onFavoriteChange && onFavoriteChange(bot.id, !fav);
    } finally { setBusy(false); }
  };

  const open = () => navigate(`/bot/${bot.slug}`);

  return (
    <div
      onClick={open}
      data-testid={`bot-card-${bot.slug}`}
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
      className="fade-up group relative flex flex-col bg-card border border-border rounded-sm p-4 cursor-pointer transition-colors duration-150 hover:border-matrix/60 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 flex items-center justify-center border border-border rounded-sm bg-matrix/5 text-matrix group-hover:box-glow transition-shadow">
          <Icon className="w-5 h-5" />
        </div>
        <button onClick={toggleFav} data-testid={`fav-btn-${bot.slug}`} className="p-1 text-muted-foreground hover:text-matrix transition-colors">
          <Star className={`w-4 h-4 ${fav ? "fill-matrix text-matrix" : ""}`} />
        </button>
      </div>
      <h3 className="font-display font-bold text-base text-white leading-tight mb-1 line-clamp-2">{bot.name}</h3>
      <div className="text-[10px] font-mono uppercase tracking-wider text-matrix/60 mb-2">{bot.suite_label}</div>
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">{bot.description}</p>
      <CapabilityBadges capabilities={bot.capabilities} />
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground group-hover:text-matrix transition-colors">Open Bot</span>
        <ArrowRight className="w-4 h-4 text-matrix opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </div>
    </div>
  );
}
