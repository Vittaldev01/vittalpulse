import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function NotificationBell() {
  const { notifications, dismissNotification, dismissAll } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = (notification: any) => {
    dismissNotification(notification.id);
    navigate(notification.link);
  };

  const campaignFailures = notifications.filter(n => n.type === 'campaign_failure');
  const chipDisconnections = notifications.filter(n => n.type === 'chip_disconnected');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {notifications.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[500px]">
        <div className="flex items-center justify-between px-2 py-2">
          <DropdownMenuLabel className="p-0">Notificações</DropdownMenuLabel>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={dismissAll}
              className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar tudo
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-auto max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="px-2 py-8 text-center text-sm text-muted-foreground">
              ✅ Sem novas notificações
            </div>
          ) : (
            <>
              {campaignFailures.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1">
                    ⚠️ Falhas de Envio
                  </DropdownMenuLabel>
                  {campaignFailures.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className="flex flex-col items-start gap-1 px-2 py-3 cursor-pointer"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start justify-between w-full gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-destructive">🔴</span>
                            <span className="font-medium text-sm">{notification.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(notification.timestamp, {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  {chipDisconnections.length > 0 && <DropdownMenuSeparator />}
                </>
              )}

              {chipDisconnections.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1">
                    📡 Desconexões
                  </DropdownMenuLabel>
                  {chipDisconnections.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className="flex flex-col items-start gap-1 px-2 py-3 cursor-pointer"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start justify-between w-full gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-destructive">🔴</span>
                            <span className="font-medium text-sm">{notification.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(notification.timestamp, {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
