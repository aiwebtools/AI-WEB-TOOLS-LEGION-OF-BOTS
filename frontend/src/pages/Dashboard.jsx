import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Search, MessageSquare, Star, History, FileText, ArrowRight, Sparkles } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import BotCard from "@/components/BotCard";
import { iconFor } from "@/lib/icons";
import MoreAiTools from "@/components/MoreAiTools";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openSearch } = useOutletContext();
  const [data, setData] = useState(null);

  useEffect(() => { api.get("/dashboard").then(({ data }) => setData(data)).catch(() => {}); }, []);

  const stats = data?.stats || {};
  const STAT = [
    { l: "Conversations", v: stats.conversations, i: MessageSquare },
    { l: "Favorites", v: stats.favorites, i: Star },
    { l: "Recent Bots", v: stats.recent_bots, i: History },
    { l: "Saved Files", v: stats.saved_files, i: FileText },
  ];

  return (
    <div className="max-w-7xl mx-auto px-5 py-8">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-matrix mb-1">// Operator console</div>
          <h1 className="font-display font-black text-3xl text-white">Welcome back, {user?.name || "Operator"}</h1>
        </div>
        <MoreAiTools variant="default" />
      </div>

      {/* search */}
      <button onClick={openSearch} data-testid="dashboard-search" className="w-full flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-sm text-muted-foreground hover:border-matrix/50 transition-colors mb-8 font-mono text-sm">
        <Search className="w-4 h-4 text-matrix" /> Search the Legion...
      </button>

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {STAT.map((s) => (
          <div key={s.l} className="bg-card border border-border rounded-sm p-4" data-testid={`stat-${s.l.toLowerCase().replace(/\s/g, "-")}`}>
            <s.i className="w-4 h-4 text-matrix mb-2" />
            <div className="font-display font-black text-2xl text-white">{s.v ?? 0}</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>

      {/* continue working */}
      {data?.conversations?.length > 0 && (
        <Section title="Continue Working" onAll={() => navigate("/conversations")}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.conversations.map((c) => {
              const Icon = iconFor(c.bot_icon);
              return (
                <button key={c.id} data-testid={`continue-conv-${c.id}`} onClick={() => navigate(`/bot/${c.bot_slug}?c=${c.id}`)} className="group flex items-center gap-3 bg-card border border-border rounded-sm p-3 text-left hover:border-matrix/50 transition-colors">
                  <div className="w-9 h-9 flex items-center justify-center border border-border rounded-sm text-matrix bg-matrix/5 shrink-0"><Icon className="w-4 h-4" /></div>
                  <div className="min-w-0 flex-1"><div className="text-sm text-white truncate">{c.title}</div><div className="text-[10px] font-mono text-muted-foreground">{c.bot_name}</div></div>
                  <ArrowRight className="w-4 h-4 text-matrix opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* favorites */}
      {data?.favorite_bots?.length > 0 && (
        <Section title="Your Favorite Bots" onAll={() => navigate("/favorites")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.favorite_bots.map((b, i) => <BotCard key={b.id} bot={b} index={i} />)}
          </div>
        </Section>
      )}

      {/* recent */}
      {data?.recent_bots?.length > 0 && (
        <Section title="Recently Used" onAll={() => navigate("/recent")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.recent_bots.map((b, i) => <BotCard key={b.id} bot={b} index={i} />)}
          </div>
        </Section>
      )}

      {/* featured */}
      <Section title="Featured Bots" icon={Sparkles} onAll={() => navigate("/bots")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(data?.featured_bots || []).map((b, i) => <BotCard key={b.id} bot={b} index={i} />)}
        </div>
      </Section>

      {/* suites */}
      <Section title="Explore the Legion" onAll={() => navigate("/suites")}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {(data?.suites || []).map((s) => {
            const Icon = iconFor(s.icon);
            return (
              <button key={s.slug} data-testid={`dash-suite-${s.slug}`} onClick={() => navigate(`/suites/${s.slug}`)} className="group bg-card border border-border rounded-sm p-4 text-left hover:border-matrix/50 hover:-translate-y-0.5 transition-colors">
                <div className="w-9 h-9 flex items-center justify-center border border-border rounded-sm text-matrix bg-matrix/5 mb-3"><Icon className="w-4 h-4" /></div>
                <div className="text-sm text-white font-medium leading-tight line-clamp-2">{s.name}</div>
                <div className="text-[10px] font-mono text-matrix/60 mt-1">{s.bot_count} bots</div>
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children, onAll, icon: Icon }) {
  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-matrix" />}{title}</h2>
        {onAll && <button onClick={onAll} className="text-xs font-mono text-matrix hover:text-matrix-dark transition-colors">View all →</button>}
      </div>
      {children}
    </div>
  );
}
