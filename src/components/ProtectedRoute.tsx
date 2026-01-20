import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-approval", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("approved")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (profile && !profile.approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="text-6xl">⏳</div>
          <h1 className="text-2xl font-bold text-foreground">Aguardando Aprovação</h1>
          <p className="text-muted-foreground">
            Sua conta foi criada com sucesso, mas ainda precisa ser aprovada por um administrador.
            Você receberá acesso assim que sua conta for aprovada.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
