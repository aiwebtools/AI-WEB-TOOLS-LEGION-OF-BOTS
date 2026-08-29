import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import api from "@/lib/api";
import BotCard from "@/components/BotCard";
import { iconFor } from "@/lib/icons";

export default function SuiteDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => { api.get(`/suites/${slug}`).then(({ data }) => setData(data)).catch(() => navigate("/suites")); }, [slug, navigate]);

  if (!data) return <div className="max-w-7xl mx-auto px-5 py-8 text-muted-foreground font-mono">Loading suite...</div>;
  const Icon = iconFor(data.suite.icon);
  const bots = data.bots.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()) || b.description.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-5 py-8">
      <button onClick={() => navigate("/suites")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-matrix transition-colors mb-6 font-mono"><ArrowLeft className="w-4 h-4" /> All Suites</button>
      <div className="flex items-center gap-4 mb-2">
        <div className="w-14 h-14 flex items-center justify-center border border-border rounded-sm bg-matrix/5 text-matrix box-glow"><Icon className="w-7 h-7" /></div>
        <div>
          <h1 className="font-display font-black text-3xl text-white">{data.suite.name}</h1>
          <div className="text-xs font-mono text-matrix/70">{data.suite.bot_count} bots</div>
        </div>
      </div>
      <p className="text-muted-foreground mb-6 max-w-2xl">{data.suite.description}</p>

      <div className="flex items-center gap-2 max-w-md px-3 py-2.5 bg-card border border-border rounded-sm mb-6 focus-within:border-matrix/50 transition-colors">
        <Search className="w-4 h-4 text-matrix" />
        <input data-testid="suite-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search within suite..." className="flex-1 bg-transparent outline-none text-white font-mono text-sm" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {bots.map((b, i) => <BotCard key={b.id} bot={b} index={i} />)}
      </div>
    </div>
  );
}
