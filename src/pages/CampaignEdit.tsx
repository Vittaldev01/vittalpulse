import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save } from "lucide-react";
import { useConnections } from "@/hooks/useConnections";
import { useContactLists } from "@/hooks/useContactLists";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MessageGroup } from "@/components/campaigns/MessageGroup";
import { DaySelector } from "@/components/campaigns/DaySelector";
import { WhatsAppPreview } from "@/components/campaigns/WhatsAppPreview";
import { AIGenerationDialog } from "@/components/campaigns/AIGenerationDialog";
import { FollowUpManager } from "@/components/campaigns/FollowUpManager";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  text: string;
  media_url?: string;
  media_type?: "image" | "video" | "audio" | "document" | "none";
}

export default function CampaignEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { connections } = useConnections();
  const { lists } = useContactLists();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    campaign_type: "simple" as "simple" | "interactive",
    connection_ids: [] as string[],
    list_ids: [] as string[],
    min_interval_seconds: 30,
    max_interval_seconds: 60,
    pause_after_messages: 20,
    pause_duration_minutes: 10,
    allowed_hours_start: "08:00",
    allowed_hours_end: "18:00",
    allowed_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  });

  const [message1, setMessage1] = useState<Message[]>([{ text: "", media_type: "none" }]);
  const [message2, setMessage2] = useState<Message[]>([{ text: "", media_type: "none" }]);

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiGeneratingFor, setAiGeneratingFor] = useState<1 | 2 | string>(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [listsOpen, setListsOpen] = useState(true);

  // Follow-up state
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpSteps, setFollowUpSteps] = useState<Array<{
    id: string;
    stepNumber: number;
    daysAfter: number;
    messages: Message[];
  }>>([]);

  useEffect(() => {
    loadCampaign();
  }, [id]);

  const loadCampaign = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("campaigns")
      .select(`
        *,
        campaign_connections(
          whatsapp_connections(id, name, status)
        ),
        follow_up_flows (
          id,
          is_active,
          total_steps,
          follow_up_messages (
            id,
            step_number,
            days_after_previous,
            messages
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      toast({
        title: "Erro ao carregar campanha",
        description: error.message,
        variant: "destructive",
      });
      navigate("/campaigns");
      return;
    }

    if (data.status !== "draft") {
      toast({
        title: "Campanha não editável",
        description: "Apenas campanhas em rascunho podem ser editadas.",
        variant: "destructive",
      });
      navigate("/campaigns");
      return;
    }

    const parsedMessages = data.messages ? JSON.parse(data.messages as string) : { part1: [], part2: [] };
    const parsedDays = typeof data.allowed_days === 'string' 
      ? JSON.parse(data.allowed_days) 
      : Array.isArray(data.allowed_days) ? data.allowed_days : ["monday", "tuesday", "wednesday", "thursday", "friday"];

    const startTime = data.allowed_hours_start ? String(data.allowed_hours_start).slice(0, 5) : "08:00";
    const endTime = data.allowed_hours_end ? String(data.allowed_hours_end).slice(0, 5) : "18:00";

    // Buscar IDs das conexões vinculadas
    const connectionIds = data.campaign_connections?.map((cc: any) => cc.whatsapp_connections.id) || 
                         (data.connection_id ? [data.connection_id] : []);

    setFormData({
      name: data.name,
      campaign_type: (data.campaign_type as "simple" | "interactive") || "simple",
      connection_ids: connectionIds,
      list_ids: data.list_id ? [data.list_id] : [],
      min_interval_seconds: data.min_interval_seconds || 30,
      max_interval_seconds: data.max_interval_seconds || 60,
      pause_after_messages: data.pause_after_messages || 20,
      pause_duration_minutes: data.pause_duration_minutes || 10,
      allowed_hours_start: startTime,
      allowed_hours_end: endTime,
      allowed_days: parsedDays,
    });

    setMessage1(parsedMessages.part1 || [{ text: "", media_type: "none" }]);
    setMessage2(parsedMessages.part2 || [{ text: "", media_type: "none" }]);

    // Carregar follow-up se existir
    if (data.follow_up_flows && data.follow_up_flows.length > 0) {
      const flow = data.follow_up_flows[0];
      setFollowUpEnabled(flow.is_active);
      
      if (flow.follow_up_messages && flow.follow_up_messages.length > 0) {
        const loadedSteps = flow.follow_up_messages.map((msg: any) => {
          const messagesData = msg.messages || { part1: [] };
          const messageTexts = messagesData.part1 || [];
          
          const messages = messageTexts.map((text: string) => ({
            text,
            media_type: 'none' as const,
          }));

          return {
            id: msg.id,
            stepNumber: msg.step_number,
            daysAfter: msg.days_after_previous,
            messages: messages.length > 0 ? messages : [{ text: "", media_type: "none" as const }],
          };
        });
        
        setFollowUpSteps(loadedSteps.sort((a: any, b: any) => a.stepNumber - b.stepNumber));
      }
    }

    setIsLoading(false);
  };

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleDay = (day: string) => {
    const current = formData.allowed_days;
    if (current.includes(day)) {
      updateFormData("allowed_days", current.filter((d) => d !== day));
    } else {
      updateFormData("allowed_days", [...current, day]);
    }
  };

  const toggleList = (listId: string) => {
    const current = formData.list_ids;
    if (current.includes(listId)) {
      updateFormData("list_ids", current.filter((id) => id !== listId));
    } else {
      updateFormData("list_ids", [...current, listId]);
    }
  };

  const toggleConnection = (connectionId: string) => {
    const current = formData.connection_ids;
    if (current.includes(connectionId)) {
      updateFormData("connection_ids", current.filter((id) => id !== connectionId));
    } else {
      updateFormData("connection_ids", [...current, connectionId]);
    }
  };

  const handleAIVariations = (variations: string[]) => {
    const newMessages = variations.map(text => ({
      text,
      media_type: "none" as const
    }));
    
    if (aiGeneratingFor === 1) {
      setMessage1(newMessages);
    } else if (aiGeneratingFor === 2) {
      setMessage2(newMessages);
    } else {
      // It's a follow-up step ID
      const stepId = aiGeneratingFor as string;
      const updatedSteps = followUpSteps.map(step =>
        step.id === stepId ? { ...step, messages: newMessages } : step
      );
      setFollowUpSteps(updatedSteps);
    }
  };

  const openAIDialog = (forMessage: 1 | 2 | string) => {
    setAiGeneratingFor(forMessage);
    setAiDialogOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      if (!formData.name.trim()) {
        toast({
          title: "Nome obrigatório",
          description: "Digite um nome para a campanha.",
          variant: "destructive",
        });
        return;
      }

      if (formData.connection_ids.length === 0) {
        toast({
          title: "Conexão obrigatória",
          description: "Selecione ao menos uma conexão do WhatsApp.",
          variant: "destructive",
        });
        return;
      }

      if (formData.list_ids.length === 0) {
        toast({
          title: "Lista obrigatória",
          description: "Selecione ao menos uma lista de contatos.",
          variant: "destructive",
        });
        return;
      }

      const validMessage1 = message1.filter(m => m.text.trim()).length > 0;
      const validMessage2 = message2.filter(m => m.text.trim()).length > 0;

      if (!validMessage1 || !validMessage2) {
        toast({
          title: "Mensagens obrigatórias",
          description: "Adicione ao menos uma variação para Mensagem 1 e Mensagem 2.",
          variant: "destructive",
        });
        return;
      }

      // Validação obrigatória: Disparo com Interação DEVE ter follow-up configurado
      if (formData.campaign_type === "interactive" && (!followUpEnabled || followUpSteps.length === 0)) {
        toast({
          title: "Follow-up obrigatório",
          description: "Campanhas com Interação devem ter ao menos uma etapa de follow-up configurada para lidar com contatos que não respondem.",
          variant: "destructive",
        });
        return;
      }

      const allMessages = {
        part1: message1.filter(m => m.text.trim()),
        part2: message2.filter(m => m.text.trim())
      };

      const { list_ids, connection_ids, ...restFormData } = formData;
      
      const campaignData = {
        ...restFormData,
        list_id: list_ids[0],
        connection_id: connection_ids[0], // Manter para compatibilidade
        messages: JSON.stringify(allMessages),
        allowed_days: JSON.stringify(formData.allowed_days),
      };

      const { error } = await supabase
        .from("campaigns")
        .update(campaignData)
        .eq("id", id);

      if (error) throw error;

      // Atualizar relacionamentos de conexões
      try {
        // Remover conexões antigas
        await supabase
          .from('campaign_connections')
          .delete()
          .eq('campaign_id', id);

        // Inserir novas conexões
        const connectionInserts = connection_ids.map(connId => ({
          campaign_id: id,
          connection_id: connId
        }));

        const { error: connectionsError } = await supabase
          .from('campaign_connections')
          .insert(connectionInserts);

        if (connectionsError) throw connectionsError;
      } catch (connError) {
        console.error('Erro ao atualizar conexões:', connError);
        toast({
          title: "Aviso",
          description: "Campanha atualizada mas houve erro ao vincular algumas conexões.",
          variant: "destructive",
        });
      }

      // Atualizar follow-up
      if (followUpEnabled && followUpSteps.length > 0) {
        // Verificar se já existe um flow
        const { data: existingFlow } = await supabase
          .from('follow_up_flows')
          .select('id')
          .eq('campaign_id', id)
          .single();

        let flowId = existingFlow?.id;

        if (!flowId) {
          // Criar novo flow
          const { data: newFlow, error: flowError } = await supabase
            .from('follow_up_flows')
            .insert({
              campaign_id: id,
              is_active: true,
              total_steps: followUpSteps.length,
            })
            .select()
            .single();

          if (flowError) throw flowError;
          flowId = newFlow.id;
        } else {
          // Atualizar flow existente
          await supabase
            .from('follow_up_flows')
            .update({
              is_active: true,
              total_steps: followUpSteps.length,
            })
            .eq('id', flowId);

          // Deletar follow_up_messages antigos
          await supabase
            .from('follow_up_messages')
            .delete()
            .eq('flow_id', flowId);
        }

        // Criar follow_up_messages para cada step
        for (const step of followUpSteps) {
          // Criar follow_up_message com mensagens inline (sem template)
          const messagesData = {
            part1: step.messages.map(msg => msg.text),
          };
          
          await supabase
            .from('follow_up_messages')
            .insert({
              flow_id: flowId,
              step_number: step.stepNumber,
              days_after_previous: step.daysAfter,
              messages: messagesData,
            });
        }
      } else if (!followUpEnabled) {
        // Desativar flow se existir
        await supabase
          .from('follow_up_flows')
          .update({ is_active: false })
          .eq('campaign_id', id);
      }

      toast({
        title: "Campanha atualizada!",
        description: "Suas alterações foram salvas.",
      });

      navigate("/campaigns");
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando campanha...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/campaigns")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Editar Campanha</h1>
            <p className="text-muted-foreground">
              Faça as alterações necessárias na sua campanha
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Campanha</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateFormData("name", e.target.value)}
                  placeholder="Ex: Promoção Black Friday"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <Label>Conexões WhatsApp</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Selecione uma ou mais conexões. Os disparos serão alternados aleatoriamente.
            </p>
            <div className="space-y-2 mt-2">
              {connections.map((conn) => (
                <label
                  key={conn.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.connection_ids.includes(conn.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Checkbox
                    checked={formData.connection_ids.includes(conn.id)}
                    onCheckedChange={() => toggleConnection(conn.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{conn.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {conn.phone_number || "Não conectado"}
                    </div>
                  </div>
                  {conn.status === "connected" && (
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  )}
                </label>
              ))}
              
              {formData.connection_ids.length > 1 && (
                <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-xs">
                    <span className="font-medium">🎲 Alternância aleatória ativada:</span> Os disparos serão distribuídos aleatoriamente entre as {formData.connection_ids.length} conexões selecionadas.
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Collapsible open={listsOpen} onOpenChange={setListsOpen}>
            <Card className="p-6">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <Label>Listas de Contatos</Label>
                  <span className="text-sm text-muted-foreground">
                    {formData.list_ids.length > 0
                      ? `${formData.list_ids.length} selecionada(s)`
                      : "Nenhuma selecionada"}
                  </span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {lists.map((list) => (
                  <div key={list.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={list.id}
                      checked={formData.list_ids.includes(list.id)}
                      onCheckedChange={() => toggleList(list.id)}
                    />
                    <Label htmlFor={list.id} className="cursor-pointer">
                      {list.name} ({list.total_contacts} contatos)
                    </Label>
                  </div>
                ))}
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <MessageGroup
            title="Mensagem 1"
            description="Primeira mensagem enviada"
            messages={message1}
            onMessagesChange={setMessage1}
            onGenerateAI={() => openAIDialog(1)}
          />

          <MessageGroup
            title="Mensagem 2"
            description="Segunda mensagem enviada"
            messages={message2}
            onMessagesChange={setMessage2}
            onGenerateAI={() => openAIDialog(2)}
          />
        </div>

        <div className="space-y-6">
          <WhatsAppPreview
            messages={[...message1, ...message2].filter(m => m.text.trim())}
          />
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <FollowUpManager
          enabled={followUpEnabled}
          steps={followUpSteps}
          onEnabledChange={setFollowUpEnabled}
          onStepsChange={setFollowUpSteps}
          onGenerateAI={openAIDialog}
        />

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <Card className="p-6">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span>Configurações Avançadas</span>
                <span className="text-sm text-muted-foreground">
                  {advancedOpen ? "Ocultar" : "Mostrar"}
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min_interval">Intervalo Mínimo (segundos)</Label>
                  <Input
                    id="min_interval"
                    type="number"
                    value={formData.min_interval_seconds}
                    onChange={(e) =>
                      updateFormData("min_interval_seconds", parseInt(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="max_interval">Intervalo Máximo (segundos)</Label>
                  <Input
                    id="max_interval"
                    type="number"
                    value={formData.max_interval_seconds}
                    onChange={(e) =>
                      updateFormData("max_interval_seconds", parseInt(e.target.value))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pause_after">Pausar Após (mensagens)</Label>
                  <Input
                    id="pause_after"
                    type="number"
                    value={formData.pause_after_messages}
                    onChange={(e) =>
                      updateFormData("pause_after_messages", parseInt(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="pause_duration">Duração da Pausa (minutos)</Label>
                  <Input
                    id="pause_duration"
                    type="number"
                    value={formData.pause_duration_minutes}
                    onChange={(e) =>
                      updateFormData("pause_duration_minutes", parseInt(e.target.value))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Horário Inicial</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.allowed_hours_start}
                    onChange={(e) =>
                      updateFormData("allowed_hours_start", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">Horário Final</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.allowed_hours_end}
                    onChange={(e) =>
                      updateFormData("allowed_hours_end", e.target.value)
                    }
                  />
                </div>
              </div>

              <div>
                <Label>Dias Permitidos</Label>
                <DaySelector
                  selectedDays={formData.allowed_days}
                  onToggle={toggleDay}
                />
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      <AIGenerationDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        onVariationsGenerated={handleAIVariations}
      />
    </div>
  );
}
