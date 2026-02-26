import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { ensureBackendToken } from "@/services/api";

interface AuthResult {
  error: Error | null;
  session: Session | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signUpComplete: (email: string, password: string, backendToken: string) => Promise<AuthResult>;
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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    if (error) {
      return { error: error as Error, session: null };
    }

    // If Supabase returned a session (auto-confirm enabled), ensure backend token is ready
    if (data?.session) {
      setSession(data.session);
      setUser(data.session.user);
      try {
        const admin = await ensureBackendToken();
        setIsAdmin(admin);
      } catch (e) {
        console.error("[AUTH] Failed to ensure backend token after signup:", e);
      }
    }

    return { error: null, session: data?.session ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error as Error, session: null };
    }

    // Ensure backend token is ready before returning
    if (data?.session) {
      setSession(data.session);
      setUser(data.session.user);
      try {
        const admin = await ensureBackendToken();
        setIsAdmin(admin);
      } catch (e) {
        console.error("[AUTH] Failed to ensure backend token after signin:", e);
      }
    }

    return { error: null, session: data?.session ?? null };
  };

  const signUpComplete = async (email: string, password: string, backendToken: string) => {
    // Store backend JWT from the OTP verification response
    localStorage.setItem("backend_token", backendToken);

    // Now sign in with Supabase to establish session
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error as Error, session: null };
    }

    if (data?.session) {
      setSession(data.session);
      setUser(data.session.user);
      setIsAdmin(checkAdminFromToken());
    }

    return { error: null, session: data?.session ?? null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    localStorage.removeItem("backend_token");
    await supabase.auth.signOut();
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signUp, signIn, signInWithGoogle, signUpComplete, signOut, refreshAdminStatus }}>
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
