import { MessageEditor } from "./MessageEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Sparkles } from "lucide-react";

interface MediaItem {
  url: string;
  type: "image" | "video" | "audio" | "document";
  name?: string;
}

interface Message {
  text: string;
  media_url?: string;
  media_type?: "image" | "video" | "audio" | "document" | "none";
  media_items?: MediaItem[];
}

interface MessageGroupProps {
  title: string;
  description: string;
  messages: Message[];
  onMessagesChange: (messages: Message[]) => void;
  onGenerateAI: () => void;
  badgeColor?: string;
  badgeText?: string;
}

export function MessageGroup({
  title,
  description,
  messages,
  onMessagesChange,
  onGenerateAI,
  badgeColor = "bg-primary",
  badgeText = "Mensagem Principal"
}: MessageGroupProps) {
  
  const addMessage = () => {
    onMessagesChange([...messages, { text: "", media_type: "none" }]);
  };

  const removeMessage = (index: number) => {
    onMessagesChange(messages.filter((_, i) => i !== index));
  };

  const updateMessage = (index: number, field: string, value: any) => {
    const newMessages = [...messages];
    // Support for atomic update of multiple media fields
    if (field === "_mediaUpdate" && typeof value === "object") {
      newMessages[index] = { ...newMessages[index], ...value };
    } else {
      newMessages[index] = { ...newMessages[index], [field]: value };
    }
    onMessagesChange(newMessages);
  };

  return (
    <Card className="p-4 space-y-4 border-l-4" style={{ borderLeftColor: `hsl(var(--${badgeColor === "bg-primary" ? "primary" : "secondary"}))` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 ${badgeColor} text-primary-foreground text-xs font-medium rounded-full`}>
            {badgeText}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onGenerateAI}
          className="border-primary text-primary hover:bg-primary/5"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Gerar com IA
        </Button>
      </div>

      <div className="space-y-3">
        {messages.map((message, index) => (
          <div key={index} className="relative">
            <div className="absolute -left-2 top-3 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground border-2 border-background">
              {index + 1}
            </div>
            <div className="pl-6">
              <MessageEditor
                index={index}
                message={message}
                onUpdate={updateMessage}
                onRemove={removeMessage}
                canRemove={messages.length > 1}
              />
            </div>
          </div>
        ))}
      </div>

      {messages.length < 7 && (
        <Button
          type="button"
          variant="outline"
          onClick={addMessage}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Variação {messages.length + 1}
        </Button>
      )}
      
      {messages.length >= 7 && (
        <p className="text-xs text-center text-muted-foreground">
          Máximo de 7 variações atingido
        </p>
      )}
    </Card>
  );
}
