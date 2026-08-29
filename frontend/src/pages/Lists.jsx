import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, History } from "lucide-react";
import api from "@/lib/api";
import BotCard from "@/components/BotCard";
import { iconFor } from "@/lib/icons";

export function Favorites() {
  const [bots, setBots] = useState(null);
  useEffect(() => { api.get("/favorites").then(({ data }) => setBots(data)).catch(() => setBots([])); }, []);
  const onFav = (id, val) => { if (!val) setBots((b) => b.filter((x) => x.id !== id)); };
  return (
    <div className="max-w-7xl mx-auto px-5 py-8">
      <div className="font-mono text-xs uppercase tracking-[0.3em] text-matrix mb-1">// Your arsenal</div>
      <h1 className="font-display font-black text-3xl text-white mb-8">Favorite Bots</h1>
      {bots && bots.length === 0 ? (
        <div className="text-center py-20" data-testid="favorites-empty"><Star className="w-8 h-8 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">Your favorite bots will appear here.</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(bots || []).map((b, i) => <BotCard key={b.id} bot={b} index={i} onFavoriteChange={onFav} />)}
        </div>
      )}
    </div>
  );
}

export function Recent() {
  const [bots, setBots] = useState(null);
  useEffect(() => { api.get("/recent").then(({ data }) => setBots(data)).catch(() => setBots([])); }, []);
  return (
    <div className="max-w-7xl mx-auto px-5 py-8">
      <div className="font-mono text-xs uppercase tracking-[0.3em] text-matrix mb-1">// Recently deployed</div>
      <h1 className="font-display font-black text-3xl text-white mb-8">Recent Bots</h1>
      {bots && bots.length === 0 ? (
        <div className="text-center py-20" data-testid="recent-empty"><History className="w-8 h-8 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">Your Legion is waiting. Choose a bot and begin.</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(bots || []).map((b, i) => <BotCard key={b.id} bot={b} index={i} />)}
        </div>
      )}
    </div>
  );
}
