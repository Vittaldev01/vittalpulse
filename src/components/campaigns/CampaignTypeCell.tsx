import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CampaignTypeCellProps {
  campaign_type?: "simple" | "interactive" | null;
  has_follow_up?: boolean;
}

function getCampaignTypeInfo(
  campaign_type?: "simple" | "interactive" | null,
  has_follow_up?: boolean
) {
  // Disparo com Interação
  if (campaign_type === "interactive") {
    return {
      label: "Disparo com Interação",
      description:
        "Envia mensagem 1, aguarda resposta do contato antes de enviar mensagem 2, com follow-up se não houver resposta",
      className: "bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700",
    };
  }

  // Disparo Direto (simple com follow-up)
  if (has_follow_up) {
    return {
      label: "Disparo Direto",
      description:
        "Envia mensagens 1 e 2 sequencialmente, seguido de follow-up se o contato não responder",
      className: "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
    };
  }

  // Disparo Simples (sem follow-up)
  return {
    label: "Disparo Simples",
    description: "Envia mensagens sem sequência de follow-up automatizada",
    className: "bg-green-100 text-green-700 border-green-300 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
  };
}

export function CampaignTypeCell({
  campaign_type,
  has_follow_up,
}: CampaignTypeCellProps) {
  const typeInfo = getCampaignTypeInfo(campaign_type, has_follow_up);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={typeInfo.className}>
            {typeInfo.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="text-sm">{typeInfo.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
