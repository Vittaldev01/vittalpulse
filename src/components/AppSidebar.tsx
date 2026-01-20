import { LayoutDashboard, MessageSquare, Users, Send, Settings, FileText, Activity, Building2 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarHeader,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Conexões WhatsApp", url: "/connections", icon: MessageSquare },
  { title: "Saúde das Conexões", url: "/connection-health", icon: Activity, description: "Monitore performance em tempo real" },
  { title: "Listas de Contatos", url: "/contacts", icon: Users },
  { title: "Campanhas", url: "/campaigns", icon: Send, description: "Disparos simples e com follow-up" },
  { title: "Logs", url: "/logs", icon: FileText },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const { data: userRole } = useUserRole();
  const isSuperAdmin = userRole === "super_admin";

  const isActive = (path: string) => {
    if (path === "/") return currentPath === path;
    return currentPath.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="border-b border-border p-4">
        {state === "expanded" ? (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">WhatsApp Pro</h2>
              <p className="text-xs text-muted-foreground">Automação Inteligente</p>
            </div>
          </div>
        ) : (
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <MessageSquare className="h-5 w-5 text-primary-foreground" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/empresas")}>
                    <NavLink
                      to="/empresas"
                      className="hover:bg-accent/50 transition-colors"
                      activeClassName="bg-accent text-accent-foreground font-medium glow-neon"
                    >
                      <Building2 className="h-4 w-4" />
                      <span>Empresas</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-accent/50 transition-colors"
                      activeClassName="bg-accent text-accent-foreground font-medium glow-neon"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
