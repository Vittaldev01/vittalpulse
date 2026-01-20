import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Moon, Sun, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { NotificationBell } from "@/components/NotificationBell";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Set default to dark mode
    document.documentElement.classList.add("dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logout realizado",
        description: "Até breve!",
      });
      navigate("/auth");
    }
  };

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-foreground" />
              {user && (
                <p className="text-sm text-muted-foreground hidden sm:block">
                  {user.email}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="text-foreground hover:bg-accent"
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="text-foreground hover:bg-destructive hover:text-destructive-foreground"
                title="Sair"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
