import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowRight, X } from "lucide-react";
import api from "@/lib/api";
import { iconFor } from "@/lib/icons";
import { CapabilityBadges } from "@/components/BotCard";

export default function GlobalSearch({ open, onClose }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState({ bots: [], suites: [] });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const run = useCallback(async (term) => {
    if (!term.trim()) { setRes({ bots: [], suites: [] }); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/search`, { params: { q: term } });
      setRes(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => run(q), 220);
    return () => clearTimeout(t);
  }, [q, run]);

  useEffect(() => {
    if (open) { setQ(""); setRes({ bots: [], suites: [] }); }
  }, [open]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;
  const openBot = (slug) => { onClose(); navigate(`/bot/${slug}`); };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 bg-black/80 backdrop-blur-sm" onClick={onClose} data-testid="global-search-overlay">
      <div className="w-full max-w-2xl bg-card border border-matrix/40 rounded-sm border-glow overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-matrix" />
          <input
            autoFocus
            data-testid="global-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the Legion..."
            className="flex-1 bg-transparent outline-none text-white placeholder:text-muted-foreground font-mono text-sm"
          />
          <button onClick={onClose} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto">
          {loading && <div className="p-4 text-sm text-muted-foreground font-mono">Scanning the Legion...</div>}
          {!loading && q && res.bots.length === 0 && res.suites.length === 0 && (
            <div className="p-8 text-center text-muted-foreground" data-testid="search-empty">No Legion bot matched that search. Try another term.</div>
          )}
          {res.suites.length > 0 && (
            <div className="px-3 pt-3">
              <div className="text-[10px] font-mono uppercase text-matrix/60 px-1 mb-1">Suites</div>
              {res.suites.map((s) => {
                const Icon = iconFor(s.icon);
                return (
                  <button key={s.slug} onClick={() => { onClose(); navigate(`/suites/${s.slug}`); }} className="w-full flex items-center gap-3 px-2 py-2 hover:bg-matrix/10 rounded-sm text-left">
                    <Icon className="w-4 h-4 text-matrix" />
                    <span className="text-sm text-white">{s.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground font-mono">{s.bot_count} bots</span>
                  </button>
                );
              })}
            </div>
          )}
          {res.bots.length > 0 && (
            <div className="p-3">
              <div className="text-[10px] font-mono uppercase text-matrix/60 px-1 mb-1">Bots</div>
              {res.bots.map((b) => {
                const Icon = iconFor(b.icon);
                return (
                  <button key={b.id} data-testid={`search-result-${b.slug}`} onClick={() => openBot(b.slug)} className="group w-full flex items-center gap-3 px-2 py-2.5 hover:bg-matrix/10 rounded-sm text-left">
                    <div className="w-9 h-9 flex items-center justify-center border border-border rounded-sm text-matrix bg-matrix/5 shrink-0"><Icon className="w-4 h-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium truncate">{b.name}</span>
                        <span className="text-[10px] font-mono text-matrix/60 shrink-0">{b.suite_label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{b.description}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-matrix opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
          {!q && (
            <div className="p-4 flex flex-wrap gap-2">
              {["books", "movie", "time machine", "agriculture", "coding", "history", "cannabis", "images"].map((t) => (
                <button key={t} onClick={() => setQ(t)} className="px-3 py-1 text-xs font-mono border border-border rounded-sm text-muted-foreground hover:border-matrix hover:text-matrix transition-colors">{t}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
