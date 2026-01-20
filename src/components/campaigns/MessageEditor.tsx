import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bold, Italic } from "lucide-react";
import { MessageVariables } from "./MessageVariables";
import { MediaUpload, MediaItem } from "./MediaUpload";

interface MessageEditorProps {
  index: number;
  message: {
    text: string;
    media_url?: string;
    media_type?: "image" | "video" | "audio" | "document" | "none";
    media_items?: MediaItem[];
  };
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  eventSelected?: boolean;
}

export function MessageEditor({ index, message, onUpdate, onRemove, canRemove }: MessageEditorProps) {
  // Convert legacy format to new array format
  const getMediaItems = (): MediaItem[] => {
    if (message.media_items && message.media_items.length > 0) {
      return message.media_items;
    }
    // Backwards compatibility with old single media format
    if (message.media_url && message.media_type && message.media_type !== "none") {
      return [{ url: message.media_url, type: message.media_type }];
    }
    return [];
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById(`message-${index}`) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = message.text;
      const newText = text.substring(0, start) + variable + text.substring(end);
      onUpdate(index, "text", newText);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const formatText = (format: "bold" | "italic") => {
    const textarea = document.getElementById(`message-${index}`) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = message.text.substring(start, end);
      
      if (selectedText) {
        const symbol = format === "bold" ? "*" : "_";
        const formattedText = `${symbol}${selectedText}${symbol}`;
        const newText = message.text.substring(0, start) + formattedText + message.text.substring(end);
        onUpdate(index, "text", newText);
        
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start, start + formattedText.length);
        }, 0);
      }
    }
  };

  const handleMediaItemsChange = (items: MediaItem[]) => {
    // Update all media fields atomically
    const mediaUpdates = {
      media_items: items,
      media_url: items.length > 0 ? items[0].url : "",
      media_type: items.length > 0 ? items[0].type : "none" as const,
    };
    onUpdate(index, "_mediaUpdate", mediaUpdates);
  };

  return (
    <div className="space-y-3 p-4 border border-border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Mensagem {index + 1}</h3>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Remover
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageVariables onSelect={insertVariable} />
          
          <div className="flex gap-1 border border-border rounded-md p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => formatText("bold")}
              className="h-7 w-7"
              title="Negrito"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => formatText("italic")}
              className="h-7 w-7"
              title="Itálico"
            >
              <Italic className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Textarea
        id={`message-${index}`}
        value={message.text}
        onChange={(e) => onUpdate(index, "text", e.target.value)}
        placeholder="Digite sua mensagem aqui... Use {{nome}} para inserir o nome do contato"
        className="min-h-[120px] resize-none"
      />

      <MediaUpload
        mediaItems={getMediaItems()}
        onMediaItemsChange={handleMediaItemsChange}
        maxItems={5}
      />
    </div>
  );
}
