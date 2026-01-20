import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

export interface Notification {
  id: string;
  type: 'campaign_failure' | 'chip_disconnected';
  title: string;
  message: string;
  timestamp: Date;
  link: string;
  campaignId?: string;
  connectionId?: string;
}

const DISMISSED_KEY = 'dismissed_notifications';

export function useNotifications() {
  const queryClient = useQueryClient();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Load dismissed IDs from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setDismissedIds(parsed);
      } catch (e) {
        console.error("Error parsing dismissed notifications:", e);
      }
    }
  }, []);

  const { data: allNotifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const notifications: Notification[] = [];

      // Fetch campaigns with failures (pause_reason = 'chip_disconnected' or failed_messages > 0)
      const { data: campaigns, error: campaignsError } = await supabase
        .from("campaigns")
        .select("id, name, failed_messages, pause_reason, updated_at")
        .or("pause_reason.eq.chip_disconnected,failed_messages.gt.0")
        .order("updated_at", { ascending: false });

      if (campaignsError) {
        console.error("Error fetching campaigns:", campaignsError);
      } else if (campaigns) {
        campaigns.forEach((campaign) => {
          const notificationId = `campaign_failure_${campaign.id}`;
          
          notifications.push({
            id: notificationId,
            type: 'campaign_failure',
            title: campaign.name,
            message: campaign.pause_reason === 'chip_disconnected' 
              ? `${campaign.failed_messages} mensagens falhadas - Chip desconectado`
              : `${campaign.failed_messages} mensagens falhadas`,
            timestamp: new Date(campaign.updated_at || Date.now()),
            link: `/campaigns/${campaign.id}`,
            campaignId: campaign.id,
          });
        });
      }

      // Fetch disconnected chips
      const { data: connections, error: connectionsError } = await supabase
        .from("whatsapp_connections")
        .select("id, name, status, updated_at")
        .eq("status", "disconnected")
        .order("updated_at", { ascending: false });

      if (connectionsError) {
        console.error("Error fetching connections:", connectionsError);
      } else if (connections) {
        connections.forEach((connection) => {
          const notificationId = `chip_disconnected_${connection.id}`;
          
          notifications.push({
            id: notificationId,
            type: 'chip_disconnected',
            title: connection.name,
            message: 'Chip desconectado',
            timestamp: new Date(connection.updated_at || Date.now()),
            link: '/connections',
            connectionId: connection.id,
          });
        });
      }

      return notifications;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Filter out dismissed notifications
  const notifications = allNotifications.filter(n => !dismissedIds.includes(n.id));

  const dismissNotification = (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(newDismissed));
  };

  const dismissAll = () => {
    const allIds = allNotifications.map(n => n.id);
    setDismissedIds(allIds);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(allIds));
  };

  return {
    notifications,
    isLoading,
    dismissNotification,
    dismissAll,
  };
}
