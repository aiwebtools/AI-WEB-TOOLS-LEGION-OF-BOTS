import { useState } from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import {
  LayoutGrid, Boxes, Star, History, MessageSquare, Settings, Shield,
  Search, LogOut, Menu, X, Terminal,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import GlobalSearch from "@/components/GlobalSearch";
import MoreAiTools from "@/components/MoreAiTools";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid, testid: "nav-dashboard" },
  { to: "/bots", label: "All Bots", icon: Terminal, testid: "nav-bots" },
  { to: "/suites", label: "Suites", icon: Boxes, testid: "nav-suites" },
  { to: "/favorites", label: "Favorites", icon: Star, testid: "nav-favorites" },
  { to: "/recent", label: "Recent", icon: History, testid: "nav-recent" },
  { to: "/conversations", label: "Conversations", icon: MessageSquare, testid: "nav-conversations" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const doLogout = async () => { await logout(); navigate("/"); };

  const SidebarInner = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-border">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2" data-testid="sidebar-logo">
          <div className="w-8 h-8 bg-matrix flex items-center justify-center rounded-sm">
            <Terminal className="w-5 h-5 text-black" />
          </div>
          <div className="text-left leading-none">
            <div className="font-display font-black text-white text-sm tracking-tight">LEGION</div>
            <div className="text-[9px] font-mono text-matrix/60 tracking-wider">OF BOTS</div>
          </div>
        </button>
      </div>

      <button
        onClick={() => { setSearchOpen(true); setMobileOpen(false); }}
        data-testid="sidebar-search-trigger"
        className="mx-4 mt-4 flex items-center gap-2 px-3 py-2 border border-border rounded-sm text-muted-foreground hover:border-matrix/50 hover:text-matrix transition-colors font-mono text-xs"
      >
        <Search className="w-4 h-4" /> Search the Legion...
      </button>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            onClick={() => setMobileOpen(false)}
            data-testid={n.testid}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors duration-150 ${
                isActive ? "bg-matrix/15 text-matrix border-l-2 border-matrix" : "text-muted-foreground hover:text-white hover:bg-secondary border-l-2 border-transparent"
              }`
            }
          >
            <n.icon className="w-4 h-4" /> {n.label}
          </NavLink>
        ))}
        {user?.role === "admin" && (
          <NavLink to="/admin" onClick={() => setMobileOpen(false)} data-testid="nav-admin"
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors ${isActive ? "bg-matrix/15 text-matrix border-l-2 border-matrix" : "text-muted-foreground hover:text-white hover:bg-secondary border-l-2 border-transparent"}`}>
            <Shield className="w-4 h-4" /> Admin
          </NavLink>
        )}
      </nav>

      <div className="p-4 border-t border-border space-y-3">
        <MoreAiTools variant="default" className="w-full justify-center" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-matrix/10 border border-border flex items-center justify-center text-matrix font-mono text-sm shrink-0">
            {(user?.name || user?.email || "?")[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-white truncate" data-testid="sidebar-username">{user?.name || "Operator"}</div>
            <div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
          </div>
          <button onClick={doLogout} data-testid="logout-btn" className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* desktop sidebar */}
      <aside className="hidden lg:block w-64 border-r border-border bg-[#070707] shrink-0 relative z-10">
        <SidebarInner />
      </aside>

      {/* mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 bg-[#070707] border-b border-border">
        <button onClick={() => setMobileOpen(true)} data-testid="mobile-menu-btn" className="text-white"><Menu className="w-6 h-6" /></button>
        <div className="font-display font-black text-white text-sm">LEGION</div>
        <button onClick={() => setSearchOpen(true)} className="text-matrix"><Search className="w-5 h-5" /></button>
      </div>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/70" onClick={() => setMobileOpen(false)}>
          <div className="w-72 h-full bg-[#070707] border-r border-border relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-muted-foreground z-10"><X className="w-5 h-5" /></button>
            <SidebarInner />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto relative pt-14 lg:pt-0">
        <Outlet context={{ openSearch: () => setSearchOpen(true) }} />
      </main>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
