import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Trash2, Search, Pencil, Check, X } from "lucide-react";
import api from "@/lib/api";
import { iconFor } from "@/lib/icons";
import { toast } from "sonner";

export default function Conversations() {
  const [convs, setConvs] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState("");
  const navigate = useNavigate();

  const load = () => api.get("/conversations", { params: { q: q || undefined } }).then(({ data }) => setConvs(data)).catch(() => {});
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q]);

  const del = async (id, e) => { e.stopPropagation(); await api.delete(`/conversations/${id}`); setConvs((c) => c.filter((x) => x.id !== id)); toast.success("Conversation deleted"); };
  const startEdit = (c, e) => { e.stopPropagation(); setEditing(c.id); setTitle(c.title); };
  const saveEdit = async (id, e) => { e.stopPropagation(); await api.patch(`/conversations/${id}`, { title }); setConvs((c) => c.map((x) => x.id === id ? { ...x, title } : x)); setEditing(null); };

  return (
    <div className="max-w-4xl mx-auto px-5 py-8">
      <div className="font-mono text-xs uppercase tracking-[0.3em] text-matrix mb-1">// Mission logs</div>
      <h1 className="font-display font-black text-3xl text-white mb-6">Conversations</h1>
      <div className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border rounded-sm mb-6 focus-within:border-matrix/50 transition-colors">
        <Search className="w-4 h-4 text-matrix" />
        <input data-testid="conv-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations..." className="flex-1 bg-transparent outline-none text-white font-mono text-sm" />
      </div>
      {convs.length === 0 ? (
        <div className="text-center py-20" data-testid="conversations-empty"><MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">Your Legion is waiting. Choose a bot and begin.</p></div>
      ) : (
        <div className="space-y-2">
          {convs.map((c) => {
            const Icon = iconFor(c.bot_icon);
            return (
              <div key={c.id} data-testid={`conv-item-${c.id}`} onClick={() => navigate(`/bot/${c.bot_slug}?c=${c.id}`)} className="group flex items-center gap-3 bg-card border border-border rounded-sm p-3 cursor-pointer hover:border-matrix/50 transition-colors">
                <div className="w-9 h-9 flex items-center justify-center border border-border rounded-sm text-matrix bg-matrix/5 shrink-0"><Icon className="w-4 h-4" /></div>
                <div className="min-w-0 flex-1">
                  {editing === c.id ? (
                    <input autoFocus value={title} onClick={(e) => e.stopPropagation()} onChange={(e) => setTitle(e.target.value)} className="w-full bg-input border border-matrix/50 rounded-sm px-2 py-1 text-sm text-white outline-none" />
                  ) : (
                    <div className="text-sm text-white truncate">{c.title}</div>
                  )}
                  <div className="text-[10px] font-mono text-muted-foreground">{c.bot_name} · {new Date(c.last_activity).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {editing === c.id ? (
                    <>
                      <button onClick={(e) => saveEdit(c.id, e)} data-testid={`conv-save-${c.id}`} className="p-1.5 text-matrix"><Check className="w-4 h-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setEditing(null); }} className="p-1.5 text-muted-foreground"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={(e) => startEdit(c, e)} data-testid={`conv-rename-${c.id}`} className="p-1.5 text-muted-foreground hover:text-matrix"><Pencil className="w-4 h-4" /></button>
                      <button onClick={(e) => del(c.id, e)} data-testid={`conv-delete-${c.id}`} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
