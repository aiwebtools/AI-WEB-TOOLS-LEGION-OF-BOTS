import { useEffect, useState } from "react";
import { Brain, Trash2, Plus, Save } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [memEnabled, setMemEnabled] = useState(user?.memory_enabled ?? true);
  const [memories, setMemories] = useState([]);
  const [newMem, setNewMem] = useState("");

  useEffect(() => { api.get("/memory").then(({ data }) => { setMemories(data.memories); setMemEnabled(data.enabled); }).catch(() => {}); }, []);

  const saveProfile = async () => {
    const { data } = await api.patch("/profile", { name, memory_enabled: memEnabled });
    updateUser(data);
    toast.success("Settings saved");
  };
  const toggleMem = async (val) => { setMemEnabled(val); const { data } = await api.patch("/profile", { memory_enabled: val }); updateUser(data); };
  const addMem = async () => { if (!newMem.trim()) return; const { data } = await api.post("/memory", { content: newMem }); setMemories((m) => [data, ...m]); setNewMem(""); toast.success("Memory added"); };
  const delMem = async (id) => { await api.delete(`/memory/${id}`); setMemories((m) => m.filter((x) => x.id !== id)); };
  const clearAll = async () => { await api.delete("/memory"); setMemories([]); toast.success("Memory cleared"); };

  return (
    <div className="max-w-2xl mx-auto px-5 py-8">
      <div className="font-mono text-xs uppercase tracking-[0.3em] text-matrix mb-1">// Operator config</div>
      <h1 className="font-display font-black text-3xl text-white mb-8">Settings</h1>

      <div className="bg-card border border-border rounded-sm p-6 mb-6">
        <h2 className="font-display font-bold text-white mb-4">Profile</h2>
        <label className="text-xs font-mono uppercase text-muted-foreground">Display Name</label>
        <input data-testid="settings-name" value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 mb-3 px-3 py-2.5 bg-input border border-border rounded-sm text-white outline-none focus:border-matrix transition-colors" />
        <label className="text-xs font-mono uppercase text-muted-foreground">Email</label>
        <input disabled value={user?.email} className="w-full mt-1 mb-4 px-3 py-2.5 bg-input border border-border rounded-sm text-muted-foreground outline-none" />
        <button onClick={saveProfile} data-testid="settings-save" className="inline-flex items-center gap-2 px-4 py-2 bg-matrix text-black font-bold rounded-sm hover:bg-matrix-dark transition-colors"><Save className="w-4 h-4" /> Save</button>
      </div>

      <div className="bg-card border border-border rounded-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-white flex items-center gap-2"><Brain className="w-4 h-4 text-matrix" /> User Memory</h2>
          <button onClick={() => toggleMem(!memEnabled)} data-testid="memory-toggle" className={`relative w-11 h-6 rounded-full transition-colors ${memEnabled ? "bg-matrix" : "bg-secondary"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-black rounded-full transition-transform ${memEnabled ? "translate-x-5" : ""}`} />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Persistent preferences bots can use across conversations (writing style, project context, your name).</p>
        <div className="flex gap-2 mb-4">
          <input data-testid="memory-input" value={newMem} onChange={(e) => setNewMem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMem()} placeholder="e.g. Prefer concise, technical answers" className="flex-1 px-3 py-2 bg-input border border-border rounded-sm text-white outline-none focus:border-matrix transition-colors text-sm" />
          <button onClick={addMem} data-testid="memory-add" className="px-3 py-2 border border-matrix/50 text-matrix rounded-sm hover:bg-matrix hover:text-black transition-colors"><Plus className="w-4 h-4" /></button>
        </div>
        {memories.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono">No memories stored.</p>
        ) : (
          <div className="space-y-2">
            {memories.map((m) => (
              <div key={m.id} className="flex items-center gap-2 bg-input border border-border rounded-sm px-3 py-2">
                <span className="flex-1 text-sm text-white">{m.content}</span>
                <button onClick={() => delMem(m.id)} data-testid={`memory-del-${m.id}`} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={clearAll} className="text-xs font-mono text-destructive hover:underline mt-2">Delete all memory</button>
          </div>
        )}
      </div>
    </div>
  );
}
