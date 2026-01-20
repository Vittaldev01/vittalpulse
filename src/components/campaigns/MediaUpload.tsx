import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Image, Video, Music, FileText, Loader2, X, Plus, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MediaItem {
  url: string;
  type: "image" | "video" | "audio" | "document";
  name?: string;
}

interface MediaUploadProps {
  mediaItems: MediaItem[];
  onMediaItemsChange: (items: MediaItem[]) => void;
  maxItems?: number;
}

const MEDIA_CONFIG = {
  image: { 
    icon: Image, 
    label: "Imagem", 
    accept: "image/jpeg,image/png,image/gif,image/webp",
    maxSize: 16 * 1024 * 1024,
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp']
  },
  video: { 
    icon: Video, 
    label: "Vídeo", 
    accept: "video/mp4,video/quicktime",
    maxSize: 16 * 1024 * 1024,
    extensions: ['mp4', 'mov']
  },
  audio: { 
    icon: Music, 
    label: "Áudio", 
    accept: "audio/mpeg,audio/ogg,audio/wav,audio/mp3,audio/mp4",
    maxSize: 16 * 1024 * 1024,
    extensions: ['mp3', 'ogg', 'wav', 'm4a']
  },
  document: { 
    icon: FileText, 
    label: "Documento", 
    accept: ".pdf,.doc,.docx",
    maxSize: 20 * 1024 * 1024,
    extensions: ['pdf', 'doc', 'docx']
  },
};

export function MediaUpload({ mediaItems = [], onMediaItemsChange, maxItems = 5 }: MediaUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: keyof typeof MEDIA_CONFIG) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (mediaItems.length >= maxItems) {
      toast({
        title: "Limite atingido",
        description: `Máximo de ${maxItems} arquivos permitidos.`,
        variant: "destructive",
      });
      return;
    }

    const config = MEDIA_CONFIG[type];

    if (file.size > config.maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: `O limite para ${config.label.toLowerCase()} é ${formatFileSize(config.maxSize)}.`,
        variant: "destructive",
      });
      return;
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !config.extensions.includes(fileExt)) {
      toast({
        title: "Formato não suportado",
        description: `Formatos aceitos: ${config.extensions.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Usuário não autenticado");

      setUploadProgress(30);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const { data, error } = await supabase.functions.invoke('upload-campaign-media', {
        body: formData,
      });

      setUploadProgress(80);

      if (error) {
        console.error('Upload error:', error);
        throw new Error(error.message || 'Erro ao fazer upload');
      }

      if (!data?.url) {
        throw new Error('URL não retornada pelo servidor');
      }

      setUploadProgress(100);

      const newItem: MediaItem = {
        url: data.url,
        type: type,
        name: file.name
      };
      
      onMediaItemsChange([...mediaItems, newItem]);

      toast({
        title: "Upload concluído!",
        description: `${config.label} enviado(a) com sucesso.`,
      });

    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro no upload",
        description: error.message || "Não foi possível fazer o upload do arquivo.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleButtonClick = (type: keyof typeof MEDIA_CONFIG) => {
    const config = MEDIA_CONFIG[type];
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = config.accept;
    input.onchange = (e) => handleFileUpload(e as any, type);
    input.click();
  };

  const removeMediaItem = (index: number) => {
    const newItems = mediaItems.filter((_, i) => i !== index);
    onMediaItemsChange(newItems);
  };

  const renderThumbnail = (item: MediaItem, index: number) => {
    return (
      <div key={index} className="relative group">
        <div className="w-20 h-20 rounded-lg border border-border overflow-hidden bg-muted">
          {item.type === 'image' && (
            <img 
              src={item.url} 
              alt={item.name || 'Imagem'} 
              className="w-full h-full object-cover"
            />
          )}
          {item.type === 'video' && (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900">
              <div className="relative">
                <Video className="h-6 w-6 text-white/70" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                    <Play className="h-2 w-2 text-white fill-white" />
                  </div>
                </div>
              </div>
            </div>
          )}
          {item.type === 'audio' && (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-purple-800">
              <Music className="h-6 w-6 text-white" />
            </div>
          )}
          {item.type === 'document' && (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800">
              <FileText className="h-6 w-6 text-white" />
            </div>
          )}
        </div>
        
        <button
          type="button"
          onClick={() => removeMediaItem(index)}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center shadow-md hover:bg-destructive/90 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
        
        <p className="text-[10px] text-center text-muted-foreground mt-1 truncate w-20">
          {MEDIA_CONFIG[item.type].label}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Media type buttons */}
      <div className="flex gap-2 flex-wrap">
        {(Object.entries(MEDIA_CONFIG) as [keyof typeof MEDIA_CONFIG, typeof MEDIA_CONFIG[keyof typeof MEDIA_CONFIG]][]).map(([type, config]) => {
          const Icon = config.icon;
          const hasThisType = mediaItems.some(item => item.type === type);
          
          return (
            <Button
              key={type}
              type="button"
              variant={hasThisType ? "default" : "outline"}
              size="sm"
              onClick={() => handleButtonClick(type)}
              disabled={isUploading || mediaItems.length >= maxItems}
              className="flex-1 min-w-[80px]"
            >
              <Icon className="h-4 w-4 mr-1" />
              {config.label}
            </Button>
          );
        })}
      </div>

      {/* Upload progress bar */}
      {isUploading && (
        <div className="p-3 bg-muted rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Enviando arquivo...</span>
          </div>
          <div className="w-full h-2 bg-background rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Media thumbnails grid */}
      {mediaItems.length > 0 && (
        <div className="flex gap-3 flex-wrap items-start">
          {mediaItems.map((item, index) => renderThumbnail(item, index))}
          
          {mediaItems.length < maxItems && !isUploading && (
            <button
              type="button"
              onClick={() => handleButtonClick('image')}
              className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[10px]">Adicionar</span>
            </button>
          )}
        </div>
      )}

      {/* Counter */}
      {mediaItems.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {mediaItems.length} de {maxItems} arquivos
        </p>
      )}
    </div>
  );
}
