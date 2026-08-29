import { useEffect, useState, useCallback } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import api from "@/lib/api";
import BotCard from "@/components/BotCard";

const CAPS = [
  { k: "", l: "All" }, { k: "image", l: "Image" }, { k: "python", l: "Python" },
  { k: "document_generation", l: "Docs" }, { k: "coding", l: "Coding" }, { k: "research", l: "Research" },
];
const SORTS = [
  { k: "recommended", l: "Recommended" }, { k: "alphabetical", l: "A-Z" },
  { k: "recent", l: "Recently Added" }, { k: "popular", l: "Most Used" },
];

export default function AllBots() {
  const [bots, setBots] = useState([]);
  const [suites, setSuites] = useState([]);
  const [q, setQ] = useState("");
  const [suite, setSuite] = useState("");
  const [cap, setCap] = useState("");
  const [sort, setSort] = useState("recommended");
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get("/suites").then(({ data }) => setSuites(data)).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/bots", { params: { q: q || undefined, suite: suite || undefined, capability: cap || undefined, sort } });
      setBots(data);
    } finally { setLoading(false); }
  }, [q, suite, cap, sort]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  return (
    <div className="max-w-7xl mx-auto px-5 py-8">
      <div className="font-mono text-xs uppercase tracking-[0.3em] text-matrix mb-1">// The full arsenal</div>
      <h1 className="font-display font-black text-3xl text-white mb-6">All Bots</h1>

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="flex items-center gap-2 flex-1 px-3 py-2.5 bg-card border border-border rounded-sm focus-within:border-matrix/50 transition-colors">
          <Search className="w-4 h-4 text-matrix" />
          <input data-testid="allbots-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bots..." className="flex-1 bg-transparent outline-none text-white font-mono text-sm" />
        </div>
        <select data-testid="filter-suite" value={suite} onChange={(e) => setSuite(e.target.value)} className="px-3 py-2.5 bg-card border border-border rounded-sm text-white font-mono text-sm outline-none focus:border-matrix">
          <option value="">All Suites</option>
          {suites.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </select>
        <select data-testid="filter-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-2.5 bg-card border border-border rounded-sm text-white font-mono text-sm outline-none focus:border-matrix">
          {SORTS.map((s) => <option key={s.k} value={s.k}>{s.l}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
        {CAPS.map((c) => (
          <button key={c.k} data-testid={`cap-filter-${c.k || "all"}`} onClick={() => setCap(c.k)} className={`px-3 py-1 text-xs font-mono rounded-sm border transition-colors ${cap === c.k ? "border-matrix text-matrix bg-matrix/10" : "border-border text-muted-foreground hover:border-matrix/50"}`}>{c.l}</button>
        ))}
      </div>

      <div className="text-xs font-mono text-muted-foreground mb-4">{bots.length} bots</div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => <div key={i} className="h-48 bg-card border border-border rounded-sm animate-pulse" />)}
        </div>
      ) : bots.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground" data-testid="allbots-empty">No Legion bot matched that search. Try another term.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {bots.map((b, i) => <BotCard key={b.id} bot={b} index={i} />)}
        </div>
      )}
    </div>
  );
}
