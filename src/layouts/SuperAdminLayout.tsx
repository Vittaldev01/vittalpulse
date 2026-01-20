import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, LogOut, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { signOut } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SuperAdminLayoutProps {
  children: ReactNode;
}

const SuperAdminLayout = ({ children }: SuperAdminLayoutProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDark = document.documentElement.classList.contains("dark");

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Erro ao sair", {
        description: error.message,
      });
    } else {
      navigate("/auth");
      toast.success("Desconectado com sucesso");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">WP</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">WhatsApp Pro</h1>
              <p className="text-xs text-muted-foreground">Super Admin</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Button>
            <div className="text-sm text-muted-foreground px-3">
              {user?.email}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              aria-label="Sair"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};

export { SuperAdminLayout };
export default SuperAdminLayout;
