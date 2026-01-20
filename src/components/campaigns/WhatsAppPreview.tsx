import { Circle } from "lucide-react";

interface WhatsAppPreviewProps {
  messages: Array<{
    text: string;
    media_url?: string;
    media_type?: string;
  }>;
}

// Parse WhatsApp-style formatting into React elements safely
function parseWhatsAppFormatting(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Replace variables with example values first
  remaining = remaining
    .replace(/\{\{nome\}\}/g, "João")
    .replace(/\{\{telefone\}\}/g, "5577981035622");

  // Split by newlines first to handle line breaks
  const lines = remaining.split('\n');
  
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      result.push(<br key={`br-${key++}`} />);
    }
    
    // Process bold and italic formatting
    let i = 0;
    while (i < line.length) {
      // Check for bold (*text*)
      const boldMatch = line.slice(i).match(/^\*([^*]+)\*/);
      if (boldMatch) {
        result.push(<strong key={key++}>{boldMatch[1]}</strong>);
        i += boldMatch[0].length;
        continue;
      }
      
      // Check for italic (_text_)
      const italicMatch = line.slice(i).match(/^_([^_]+)_/);
      if (italicMatch) {
        result.push(<em key={key++}>{italicMatch[1]}</em>);
        i += italicMatch[0].length;
        continue;
      }
      
      // Find the next special character or end of line
      let nextSpecial = line.length;
      const boldIndex = line.indexOf('*', i);
      const italicIndex = line.indexOf('_', i);
      
      if (boldIndex !== -1 && boldIndex < nextSpecial) nextSpecial = boldIndex;
      if (italicIndex !== -1 && italicIndex < nextSpecial) nextSpecial = italicIndex;
      
      if (nextSpecial > i) {
        result.push(line.slice(i, nextSpecial));
        i = nextSpecial;
      } else {
        // No more special characters, add the rest
        result.push(line.slice(i));
        break;
      }
    }
  });

  return result;
}

export function WhatsAppPreview({ messages }: WhatsAppPreviewProps) {
  const firstMessage = messages[0] || { text: "" };

  return (
    <div className="sticky top-4 h-fit">
      <div className="rounded-lg overflow-hidden border border-border shadow-lg">
        {/* WhatsApp Header */}
        <div className="bg-[#128C7E] p-3 flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center">
              <Circle className="h-6 w-6 text-white fill-white" />
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-gray-400 border-2 border-[#128C7E]" />
          </div>
          <div className="flex-1">
            <div className="text-white font-medium text-sm">Contato</div>
            <div className="text-white/80 text-xs">offline</div>
          </div>
        </div>

        {/* WhatsApp Chat Area */}
        <div 
          className="p-4 min-h-[400px] flex flex-col justify-end"
          style={{
            backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"40\" height=\"40\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M0 0h40v40H0z\" fill=\"%23e5ddd5\" fill-opacity=\"0.06\"/%3E%3C/svg%3E')",
            backgroundColor: "#e5ddd5"
          }}
        >
          {firstMessage.text ? (
            <div className="flex justify-end mb-2">
              <div className="max-w-[80%]">
                {firstMessage.media_url && (
                  <div className="bg-white rounded-lg mb-1 overflow-hidden">
                    <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground text-sm">
                      [{firstMessage.media_type || "mídia"}]
                    </div>
                  </div>
                )}
                <div className="bg-[#dcf8c6] rounded-lg p-3 shadow-sm">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                    {parseWhatsAppFormatting(firstMessage.text)}
                  </p>
                  <div className="text-xs text-gray-500 text-right mt-1">
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-8">
              Digite uma mensagem para ver o preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
