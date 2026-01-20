import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export const signUp = async (email: string, password: string, fullName: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${window.location.origin}/`,
    },
  });
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  
  // Se o erro for "session_not_found", considerar como logout bem-sucedido
  // porque se a sessão não existe, o usuário já está deslogado
  if (error?.message?.includes("session_not_found") || 
      error?.message?.includes("Auth session missing")) {
    return { error: null };
  }
  
  return { error };
};

export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
};
