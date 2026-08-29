import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Terminal } from "lucide-react";
import api, { formatError } from "@/lib/api";
import { toast } from "sonner";

export default function Forgot() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault(); setError("");
    try { await api.post("/auth/forgot-password", { email }); setSent(true); toast.success("If the account exists, a reset link was generated."); }
    catch (err) { setError(formatError(err.response?.data?.detail)); }
  };

  return (
    <div className="min-h-screen flex items-center bg-background">
      <div className="w-full max-w-md mx-auto px-6">
        <button onClick={() => navigate("/auth?mode=login")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-matrix mb-8 font-mono"><ArrowLeft className="w-4 h-4" /> Back to login</button>
        <div className="flex items-center gap-2 mb-6"><div className="w-9 h-9 bg-matrix flex items-center justify-center rounded-sm"><Terminal className="w-5 h-5 text-black" /></div><div className="font-display font-black text-white">LEGION</div></div>
        <h1 className="font-display font-black text-2xl text-white mb-2">Reset password</h1>
        {sent ? (
          <p className="text-muted-foreground" data-testid="forgot-sent">If an account exists for <span className="text-matrix">{email}</span>, a reset link has been generated (check server logs in this demo environment).</p>
        ) : (
          <form onSubmit={submit} className="space-y-4 mt-4">
            <input data-testid="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@domain.com" className="w-full px-3 py-2.5 bg-input border border-border rounded-sm text-white outline-none focus:border-matrix transition-colors" />
            {error && <div className="text-sm text-destructive font-mono">{error}</div>}
            <button type="submit" data-testid="forgot-submit" className="w-full px-4 py-2.5 bg-matrix text-black font-bold rounded-sm hover:bg-matrix-dark transition-colors">Send reset link</button>
          </form>
        )}
      </div>
    </div>
  );
}
