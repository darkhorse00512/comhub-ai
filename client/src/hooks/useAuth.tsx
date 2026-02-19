import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { ensureBackendToken } from "@/services/api";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshAdminStatus: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const checkAdminFromToken = (): boolean => {
  try {
    const token = localStorage.getItem("backend_token");
    if (!token) return false;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.is_admin === true;
  } catch {
    return false;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(() => checkAdminFromToken());

  const refreshAdminStatus = useCallback(() => {
    setIsAdmin(checkAdminFromToken());
  }, []);

  // Actively fetch backend token and check admin status
  const fetchAndCheckAdmin = useCallback(async () => {
    const admin = await ensureBackendToken();
    setIsAdmin(admin);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (session) {
          // Actively fetch backend token to determine admin status
          fetchAndCheckAdmin();
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session) {
        fetchAndCheckAdmin();
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchAndCheckAdmin]);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    localStorage.removeItem("backend_token");
    await supabase.auth.signOut();
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signUp, signIn, signOut, refreshAdminStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
