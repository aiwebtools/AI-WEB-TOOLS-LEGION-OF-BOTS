import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Forgot from "@/pages/Forgot";
import Legal from "@/pages/Legal";
import Dashboard from "@/pages/Dashboard";
import AllBots from "@/pages/AllBots";
import Suites from "@/pages/Suites";
import SuiteDetail from "@/pages/SuiteDetail";
import BotWorkspace from "@/pages/BotWorkspace";
import Conversations from "@/pages/Conversations";
import Settings from "@/pages/Settings";
import Admin from "@/pages/Admin";
import { Favorites, Recent } from "@/pages/Lists";
import { Loader2 } from "lucide-react";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) {
    return <div className="h-screen flex items-center justify-center bg-background text-matrix"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth?mode=login" replace />;
  return children;
}

function AdminOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) {
    return <div className="h-screen flex items-center justify-center bg-background text-matrix"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth?mode=login" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/privacy" element={<Legal />} />
      <Route path="/terms" element={<Legal />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/bots" element={<AllBots />} />
        <Route path="/suites" element={<Suites />} />
        <Route path="/suites/:slug" element={<SuiteDetail />} />
        <Route path="/bot/:slug" element={<BotWorkspace />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/recent" element={<Recent />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<AdminOnly><Admin /></AdminOnly>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster theme="dark" position="top-right" toastOptions={{ style: { background: "#0C0C0C", border: "1px solid #1F2937", color: "#fff", fontFamily: "JetBrains Mono, monospace", fontSize: "13px" } }} />
      </AuthProvider>
    </div>
  );
}

export default App;
