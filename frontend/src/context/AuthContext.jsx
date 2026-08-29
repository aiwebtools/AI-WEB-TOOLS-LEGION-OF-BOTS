import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=anon, obj=user
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("legion_token");
    if (!token) { setUser(false); setLoading(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("legion_token");
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const finishAuth = (data) => {
    localStorage.setItem("legion_token", data.token);
    setUser(data.user);
  };

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    finishAuth(data);
    return data.user;
  };

  const register = async (email, password, name) => {
    const { data } = await api.post("/auth/register", { email, password, name });
    finishAuth(data);
    return data.user;
  };

  const googleLogin = async (session_id) => {
    const { data } = await api.post("/auth/google", { session_id });
    finishAuth(data);
    return data.user;
  };

  const logout = async () => {
    localStorage.removeItem("legion_token");
    setUser(false);
  };

  const updateUser = (u) => setUser(u);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, logout, refresh, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
