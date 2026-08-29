import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Terminal, ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatError } from "@/lib/api";
import MatrixRain from "@/components/MatrixRain";
import { toast } from "sonner";

export default function Auth() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, register, googleLogin, user } = useAuth();
  const mode = params.get("mode") === "register" ? "register" : "login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Handle Emergent Google auth return (session_id in URL hash)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("session_id=")) {
      const sid = new URLSearchParams(hash.replace("#", "")).get("session_id");
      if (sid) {
        setGoogleBusy(true);
        googleLogin(sid)
          .then(() => { window.location.hash = ""; navigate("/dashboard"); })
          .catch((e) => { setError(formatError(e.response?.data?.detail) || "Google sign-in failed"); setGoogleBusy(false); });
      }
    }
  }, [googleLogin, navigate]);

  useEffect(() => { if (user) navigate("/dashboard"); }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      if (mode === "register") { await register(email, password, name); }
      else { await login(email, password); }
      toast.success(mode === "register" ? "Welcome to the Legion." : "Access granted.");
      navigate("/dashboard");
    } catch (err) {
      setError(formatError(err.response?.data?.detail) || err.message);
    } finally { setBusy(false); }
  };

  const startGoogle = () => {
    const redirectUrl = `${window.location.origin}/auth`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  if (googleBusy) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center"><Loader2 className="w-8 h-8 text-matrix animate-spin mx-auto mb-3" /><p className="font-mono text-sm text-muted-foreground">Authenticating with Google...</p></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background relative">
      <MatrixRain className="absolute inset-0 w-full h-full" opacity={0.12} />
      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col justify-center px-6 py-12">
        <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-matrix transition-colors mb-8 font-mono"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-matrix flex items-center justify-center rounded-sm"><Terminal className="w-5 h-5 text-black" /></div>
          <div className="leading-none"><div className="font-display font-black text-white">LEGION</div><div className="text-[10px] font-mono text-matrix tracking-widest">OF BOTS</div></div>
        </div>

        <h1 className="font-display font-black text-2xl text-white mb-1">{mode === "register" ? "Enter the Legion" : "Welcome back"}</h1>
        <p className="text-sm text-muted-foreground mb-8">{mode === "register" ? "Create your free account to deploy 150 specialized bots." : "Sign in to access your bots and conversations."}</p>

        <button onClick={startGoogle} data-testid="google-auth-btn" className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-border rounded-sm text-white hover:border-matrix hover:text-matrix transition-colors mb-4 font-mono text-sm">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M12.24 10.4V14h5.02c-.22 1.2-.9 2.2-1.9 2.9v2.4h3.06c1.8-1.66 2.84-4.1 2.84-7 0-.66-.06-1.3-.17-1.9z"/><path fill="currentColor" d="M12.24 21c2.56 0 4.7-.85 6.27-2.3l-3.06-2.4c-.85.57-1.94.9-3.2.9-2.46 0-4.55-1.66-5.3-3.9H3.78v2.45C5.34 18.9 8.55 21 12.24 21z"/><path fill="currentColor" d="M6.94 13.3a5.4 5.4 0 0 1 0-3.5V7.35H3.78a9 9 0 0 0 0 8.4z"/><path fill="currentColor" d="M12.24 6.4c1.4 0 2.65.48 3.63 1.42l2.72-2.72C16.94 3.5 14.8 2.6 12.24 2.6 8.55 2.6 5.34 4.7 3.78 7.35l3.16 2.45c.75-2.24 2.84-3.4 5.3-3.4z"/></svg>
          Continue with Google
        </button>
        <div className="flex items-center gap-3 mb-4"><div className="flex-1 h-px bg-border" /><span className="text-[10px] font-mono text-muted-foreground">OR</span><div className="flex-1 h-px bg-border" /></div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground">Name</label>
              <input data-testid="auth-name-input" value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 px-3 py-2.5 bg-input border border-border rounded-sm text-white outline-none focus:border-matrix transition-colors" placeholder="Neo" />
            </div>
          )}
          <div>
            <label className="text-xs font-mono uppercase text-muted-foreground">Email</label>
            <input data-testid="auth-email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mt-1 px-3 py-2.5 bg-input border border-border rounded-sm text-white outline-none focus:border-matrix transition-colors" placeholder="you@domain.com" />
          </div>
          <div>
            <label className="text-xs font-mono uppercase text-muted-foreground">Password</label>
            <input data-testid="auth-password-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mt-1 px-3 py-2.5 bg-input border border-border rounded-sm text-white outline-none focus:border-matrix transition-colors" placeholder="••••••••" />
          </div>
          {error && <div data-testid="auth-error" className="text-sm text-destructive font-mono border border-destructive/40 bg-destructive/10 px-3 py-2 rounded-sm">{error}</div>}
          <button type="submit" disabled={busy} data-testid="auth-submit-btn" className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-matrix text-black font-bold rounded-sm hover:bg-matrix-dark transition-colors disabled:opacity-60">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "register" ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <button onClick={() => setParams({ mode: mode === "register" ? "login" : "register" })} data-testid="auth-toggle-mode" className="text-muted-foreground hover:text-matrix transition-colors font-mono text-xs">
            {mode === "register" ? "Already have an account? Sign in" : "New here? Create account"}
          </button>
          {mode === "login" && (
            <button onClick={() => navigate("/forgot")} className="text-muted-foreground hover:text-matrix transition-colors font-mono text-xs">Forgot?</button>
          )}
        </div>
      </div>
    </div>
  );
}
