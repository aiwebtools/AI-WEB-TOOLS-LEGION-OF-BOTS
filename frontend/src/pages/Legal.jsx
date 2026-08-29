import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Legal() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPrivacy = location.pathname.includes("privacy");
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-5 py-12">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-matrix mb-8 font-mono"><ArrowLeft className="w-4 h-4" /> Back</button>
        <h1 className="font-display font-black text-3xl text-white mb-6">{isPrivacy ? "Privacy Policy" : "Terms of Service"}</h1>
        <div className="md text-muted-foreground space-y-4">
          <p>THE AI WEB TOOLS LEGION OF BOTS ("LEGION") provides access to specialized AI bots free of charge.</p>
          {isPrivacy ? (
            <>
              <h3>Data we store</h3>
              <p>Your account details, conversations, favorites, and optional memory are stored securely and are only accessible to you. You may delete your conversations and memory at any time from Settings.</p>
              <h3>Your control</h3>
              <p>You can clear memory, delete conversations, and stop using the service at any time. We never expose your data to other users.</p>
            </>
          ) : (
            <>
              <h3>Acceptable use</h3>
              <p>Use the bots lawfully. Each bot follows its own operational instructions; outputs are AI-generated and should be reviewed before reliance.</p>
              <h3>Availability</h3>
              <p>The platform is provided as-is. AI inference is powered by third-party model providers.</p>
            </>
          )}
          <p className="font-mono text-xs pt-6">Also explore our full AI tool directory at <a href="https://aiwebtools.app" target="_blank" rel="noopener noreferrer" className="text-matrix">aiwebtools.app</a>.</p>
        </div>
      </div>
    </div>
  );
}
