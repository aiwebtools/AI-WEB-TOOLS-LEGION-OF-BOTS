import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { iconFor } from "@/lib/icons";

export default function Suites() {
  const [suites, setSuites] = useState([]);
  const navigate = useNavigate();
  useEffect(() => { api.get("/suites").then(({ data }) => setSuites(data)).catch(() => {}); }, []);

  return (
    <div className="max-w-7xl mx-auto px-5 py-8">
      <div className="font-mono text-xs uppercase tracking-[0.3em] text-matrix mb-1">// Organized intelligence</div>
      <h1 className="font-display font-black text-3xl text-white mb-8">Suites</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {suites.map((s) => {
          const Icon = iconFor(s.icon);
          return (
            <div key={s.slug} onClick={() => navigate(`/suites/${s.slug}`)} data-testid={`suite-card-${s.slug}`} className="group bg-card border border-border rounded-sm p-6 cursor-pointer hover:border-matrix/60 hover:-translate-y-0.5 transition-colors duration-150">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center border border-border rounded-sm bg-matrix/5 text-matrix group-hover:box-glow transition-shadow"><Icon className="w-6 h-6" /></div>
                <span className="text-xs font-mono text-matrix/70">{s.bot_count} bots</span>
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-1">{s.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
