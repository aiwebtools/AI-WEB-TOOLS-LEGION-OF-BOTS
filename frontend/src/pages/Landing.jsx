import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, Terminal, Zap, Shield, Boxes, Layers, Cpu } from "lucide-react";
import MatrixRain from "@/components/MatrixRain";
import MoreAiTools from "@/components/MoreAiTools";
import { iconFor } from "@/lib/icons";
import api from "@/lib/api";

export default function Landing() {
  const navigate = useNavigate();
  const [suites, setSuites] = useState([]);
  const [stats, setStats] = useState({ bots: 150, suites: 14 });

  useEffect(() => {
    api.get("/suites").then(({ data }) => {
      setSuites(data);
      setStats((s) => ({ ...s, suites: data.length }));
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background relative">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-black/85 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2" data-testid="landing-logo">
            <div className="w-8 h-8 bg-matrix flex items-center justify-center rounded-sm"><Terminal className="w-5 h-5 text-black" /></div>
            <div className="leading-none">
              <div className="font-display font-black text-white text-sm">THE AI WEB TOOLS</div>
              <div className="text-[10px] font-mono text-matrix tracking-[0.3em]">LEGION OF BOTS</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MoreAiTools variant="ghost" className="hidden sm:inline-flex" />
            <button onClick={() => navigate("/auth?mode=login")} data-testid="header-login-btn" className="px-4 py-2 text-sm text-white hover:text-matrix transition-colors font-mono">Login</button>
            <button onClick={() => navigate("/auth?mode=register")} data-testid="header-signup-btn" className="px-4 py-2 text-sm bg-matrix text-black font-bold rounded-sm hover:bg-matrix-dark transition-colors">Sign Up</button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden scanlines border-b border-border">
        <MatrixRain className="absolute inset-0 w-full h-full" opacity={0.25} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/70 to-background" />
        <div className="relative max-w-5xl mx-auto px-5 py-28 md:py-36">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-matrix/40 rounded-sm mb-6 font-mono text-xs text-matrix bg-matrix/5">
            <Zap className="w-3 h-3" /> 150 SPECIALIZED AI BOTS · FREE ACCESS
          </div>
          <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.05] mb-6">
            THE AI WEB TOOLS<br /><span className="text-matrix text-glow">LEGION OF BOTS</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mb-10">
            150 specialized AI minds. Organized into powerful suites. Built to help you get things done — writing, research, coding, film, agriculture, and far beyond.
          </p>
          <div className="flex flex-wrap gap-4">
            <button onClick={() => navigate("/auth?mode=register")} data-testid="enter-legion-btn" className="group inline-flex items-center gap-2 px-6 py-3 bg-matrix text-black font-bold rounded-sm hover:bg-matrix-dark transition-colors box-glow">
              Enter the Legion <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={() => navigate("/auth?mode=login")} data-testid="explore-bots-btn" className="inline-flex items-center gap-2 px-6 py-3 border border-border text-white rounded-sm hover:border-matrix hover:text-matrix transition-colors font-mono">
              Explore the Bots
            </button>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-b border-border bg-[#070707]">
        <div className="max-w-7xl mx-auto px-5 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { n: "150", l: "Specialized Bots", i: Cpu },
            { n: String(stats.suites), l: "Powerful Suites", i: Boxes },
            { n: "3", l: "Selectable Models", i: Layers },
            { n: "∞", l: "Long Context", i: Terminal },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <s.i className="w-5 h-5 text-matrix mx-auto mb-2" />
              <div className="font-display font-black text-3xl text-white text-glow">{s.n}</div>
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SUITES */}
      <section className="max-w-7xl mx-auto px-5 py-20">
        <div className="mb-10">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-matrix mb-2">// Explore the arsenal</div>
          <h2 className="font-display font-bold text-3xl text-white">Powerful Suites</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {suites.map((s) => {
            const Icon = iconFor(s.icon);
            return (
              <div key={s.slug} onClick={() => navigate("/auth?mode=register")} data-testid={`landing-suite-${s.slug}`} className="group bg-card border border-border rounded-sm p-5 cursor-pointer hover:border-matrix/60 hover:-translate-y-0.5 transition-colors duration-150">
                <div className="w-11 h-11 flex items-center justify-center border border-border rounded-sm bg-matrix/5 text-matrix mb-4 group-hover:box-glow transition-shadow"><Icon className="w-5 h-5" /></div>
                <h3 className="font-display font-bold text-white mb-1">{s.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                <div className="mt-3 text-xs font-mono text-matrix/70">{s.bot_count} bots →</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-[#070707]">
        <div className="max-w-4xl mx-auto px-5 py-20 text-center">
          <Shield className="w-8 h-8 text-matrix mx-auto mb-5" />
          <h2 className="font-display font-black text-3xl md:text-4xl text-white mb-4">One AI hub. Specialized intelligence everywhere.</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">Create your free account and deploy any of the 150 bots — each following its own dedicated operational instructions.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button onClick={() => navigate("/auth?mode=register")} className="px-6 py-3 bg-matrix text-black font-bold rounded-sm hover:bg-matrix-dark transition-colors">Enter the Legion</button>
            <MoreAiTools variant="default" />
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs font-mono text-muted-foreground">© 2026 THE AI WEB TOOLS · LEGION OF BOTS</div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <a href="https://aiwebtools.app" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-matrix transition-colors">AIWebTools.app</a>
            <button onClick={() => navigate("/privacy")} className="text-muted-foreground hover:text-matrix transition-colors">Privacy</button>
            <button onClick={() => navigate("/terms")} className="text-muted-foreground hover:text-matrix transition-colors">Terms</button>
            <MoreAiTools variant="ghost" />
          </div>
        </div>
      </footer>
    </div>
  );
}
