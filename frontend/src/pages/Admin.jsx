import { useEffect, useState } from "react";
import { Shield, Search, Eye, Power, Star } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function Admin() {
  const [ov, setOv] = useState(null);
  const [bots, setBots] = useState([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);

  const loadBots = () => api.get("/admin/bots", { params: { q: q || undefined } }).then(({ data }) => setBots(data)).catch(() => {});
  useEffect(() => { api.get("/admin/overview").then(({ data }) => setOv(data)).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(loadBots, 200); return () => clearTimeout(t); }, [q]);

  const patch = async (id, body) => {
    const { data } = await api.patch(`/admin/bots/${id}`, body);
    setBots((b) => b.map((x) => x.id === id ? data : x));
    if (sel?.id === id) setSel(data);
    toast.success("Bot updated");
  };
  const viewBot = async (id) => { const { data } = await api.get(`/admin/bots/${id}`); setSel(data); };

  return (
    <div className="max-w-7xl mx-auto px-5 py-8">
      <div className="flex items-center gap-2 mb-1"><Shield className="w-4 h-4 text-matrix" /><div className="font-mono text-xs uppercase tracking-[0.3em] text-matrix">// Command center</div></div>
      <h1 className="font-display font-black text-3xl text-white mb-6">Admin Dashboard</h1>

      {ov && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {[["Total Bots", ov.total_bots], ["Active", ov.active_bots], ["Library", ov.library_bots], ["Suites", ov.total_suites], ["Users", ov.users], ["Convos", ov.conversations], ["Messages", ov.messages]].map(([l, v]) => (
            <div key={l} className="bg-card border border-border rounded-sm p-3">
              <div className="font-display font-black text-xl text-white">{v}</div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border rounded-sm mb-4 max-w-md focus-within:border-matrix/50 transition-colors">
        <Search className="w-4 h-4 text-matrix" />
        <input data-testid="admin-bot-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bots..." className="flex-1 bg-transparent outline-none text-white font-mono text-sm" />
      </div>

      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0f1a0f] text-matrix font-mono text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Bot</th>
              <th className="text-left px-4 py-2 hidden md:table-cell">Suite</th>
              <th className="text-left px-4 py-2 hidden lg:table-cell">Ver</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bots.map((b) => (
              <tr key={b.id} className="border-t border-border hover:bg-secondary/50" data-testid={`admin-bot-row-${b.slug}`}>
                <td className="px-4 py-2 text-white">{b.name}</td>
                <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">{b.suite_label}</td>
                <td className="px-4 py-2 text-muted-foreground font-mono hidden lg:table-cell">v{b.version_count}</td>
                <td className="px-4 py-2"><span className={`text-xs font-mono ${b.status === "active" ? "text-matrix" : "text-muted-foreground"}`}>{b.status}</span></td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => viewBot(b.id)} data-testid={`admin-view-${b.slug}`} className="p-1.5 text-muted-foreground hover:text-matrix" title="Preview instructions"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => patch(b.id, { featured: !b.featured })} className={`p-1.5 ${b.featured ? "text-matrix" : "text-muted-foreground hover:text-matrix"}`} title="Feature"><Star className={`w-4 h-4 ${b.featured ? "fill-matrix" : ""}`} /></button>
                    <button onClick={() => patch(b.id, { status: b.status === "active" ? "library" : "active" })} data-testid={`admin-toggle-${b.slug}`} className="p-1.5 text-muted-foreground hover:text-white" title="Toggle active"><Power className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSel(null)}>
          <div className="w-full max-w-2xl max-h-[80vh] bg-card border border-matrix/40 rounded-sm border-glow flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-display font-bold text-white">{sel.name} — Operational Instructions</h3>
              <button onClick={() => setSel(null)} data-testid="admin-modal-close" className="text-muted-foreground hover:text-white">✕</button>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="text-xs font-mono text-matrix/60 mb-2">Source: {sel.source_document} · v{sel.version_count}</div>
              <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono bg-input p-3 rounded-sm border border-border">{sel.system_instructions}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
