import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { useConnections } from "@/hooks/useConnections";
import { useContactLists } from "@/hooks/useContactLists";
import { useCampaigns } from "@/hooks/useCampaigns";
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

export default function CampaignNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { connections } = useConnections();
  const { lists } = useContactLists();
  const { createCampaign } = useCampaigns();

  const [formData, setFormData] = useState({
    name: "",
    campaign_type: "simple" as "simple" | "interactive",
    interaction_config: {
      delay_after_response_seconds: 10,
      timeout_hours: 24,
    },
    connection_ids: [] as string[],
    list_ids: [] as string[],
    min_interval_seconds: 30,
    max_interval_seconds: 60,
    pause_after_messages: 20,
    pause_duration_minutes: 10,
    allowed_hours_start: "08:00",
    allowed_hours_end: "18:00",
    allowed_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    scheduled_at: undefined as string | undefined,
  });

  const [message1, setMessage1] = useState<Message[]>([
    { text: "", media_type: "none" }
  ]);

  const [message2, setMessage2] = useState<Message[]>([
    { text: "", media_type: "none" }
  ]);

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiGeneratingFor, setAiGeneratingFor] = useState<1 | 2 | string>(1);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
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

  const handleSubmit = () => {
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

    // Combinar as mensagens
    const allMessages = {
      part1: message1.filter(m => m.text.trim()),
      part2: message2.filter(m => m.text.trim())
    };

    // Remove list_ids e connection_ids para processar separadamente
    const { list_ids, connection_ids, interaction_config, ...restFormData } = formData;
    
    const campaignData = {
      ...restFormData,
      list_id: list_ids[0],
      connection_id: connection_ids[0], // Manter para compatibilidade
      messages: JSON.stringify(allMessages),
      scheduled_at: scheduleEnabled ? formData.scheduled_at : undefined,
      interaction_config: formData.campaign_type === 'interactive' ? interaction_config : undefined,
    };

    createCampaign.mutate(campaignData as any, {
      onSuccess: async (campaign) => {
        // Inserir relacionamentos na tabela campaign_connections
        const connectionInserts = connection_ids.map(connId => ({
          campaign_id: campaign.id,
          connection_id: connId
        }));

        const { error: connectionsError } = await supabase
          .from('campaign_connections')
          .insert(connectionInserts);

        if (connectionsError) {
          console.error('Erro ao vincular conexões:', connectionsError);
          toast({
            title: "Aviso",
            description: "Campanha criada mas houve erro ao vincular algumas conexões.",
            variant: "destructive",
          });
        } else {
          console.log(`✅ ${connection_ids.length} conexão(ões) vinculada(s) à campanha`);
        }
        
        // Auto-invocar send-campaign-messages para iniciar envio
        try {
          const { error: sendError } = await supabase.functions.invoke('send-campaign-messages', {
            body: {}
          });
          
          if (sendError) {
            console.error('Erro ao iniciar disparo:', sendError);
            toast({
              title: "Aviso",
              description: "Campanha criada mas disparo não iniciou. Use o botão 'Retomar Disparo'.",
              variant: "destructive",
            });
          } else {
            console.log('✅ Disparo iniciado automaticamente');
          }
        } catch (error) {
          console.error('Erro ao invocar send-campaign-messages:', error);
        }

        // Se follow-up está habilitado, criar o fluxo
        if (followUpEnabled && followUpSteps.length > 0) {
          try {
            // Criar follow_up_flow
            const { data: flow, error: flowError } = await supabase
              .from('follow_up_flows')
              .insert({
                campaign_id: campaign.id,
                is_active: true,
                total_steps: followUpSteps.length,
              })
              .select()
              .single();

            if (flowError) {
              console.error('Erro ao criar follow-up flow:', flowError);
            } else {
              // Criar follow_up_messages para cada step
              for (const step of followUpSteps) {
                const messagesData = {
                  part1: step.messages.map(msg => msg.text),
                };
                
                await supabase.from('follow_up_messages').insert({
                  flow_id: flow.id,
                  step_number: step.stepNumber,
                  days_after_previous: step.daysAfter,
                  messages: messagesData,
                });
              }

              // Auto-invocar initialize-follow-up-status
              try {
                const { data: initData, error: initError } = await supabase.functions.invoke('initialize-follow-up-status', {
                  body: { campaign_id: campaign.id }
                });
                
                if (initError) {
                  console.error('Erro ao inicializar follow-up status:', initError);
                } else {
                  console.log(`✅ Follow-up status inicializado: ${initData.created} registros criados`);
                }
              } catch (error) {
                console.error('Erro ao invocar initialize-follow-up-status:', error);
              }
            }
          } catch (error) {
            console.error('Erro ao criar follow-ups:', error);
          }
        }

        // SEMPRE redirecionar para a página da campanha
        toast({
          title: "Campanha iniciada!",
          description: "Você será redirecionado para acompanhar o disparo.",
        });
        navigate(`/campaigns/${campaign.id}`);
      },
    });
  };

  const connectedConnections = connections.filter(c => c.status === "connected");
  const totalContacts = lists
    .filter(l => formData.list_ids.includes(l.id))
    .reduce((sum, l) => sum + (l.total_contacts || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/campaigns")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Disparos de Mensagens</h1>
            <p className="text-muted-foreground">Configure e envie mensagens personalizadas para seus contatos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
          {/* Left Column - Form */}
          <div className="space-y-6">
            {/* Nome da Campanha */}
            <Card className="p-4 space-y-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Nome da Campanha *</h3>
                <p className="text-xs text-muted-foreground">
                  Dê um nome para identificar esta campanha no histórico
                </p>
              </div>
              <Input
                value={formData.name}
                onChange={(e) => updateFormData("name", e.target.value)}
                placeholder="Ex: Black Friday 2024 - Lista VIP"
                className="w-full"
              />
            </Card>

            {/* Tipo de Disparo */}
            <Card className="p-4 space-y-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Tipo de Disparo *</h3>
                <p className="text-xs text-muted-foreground">
                  Escolha como as mensagens serão enviadas aos contatos
                </p>
              </div>
              
              <div className="space-y-2">
                <label
                  className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    formData.campaign_type === 'simple'
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => updateFormData("campaign_type", "simple")}
                >
                  <div className="pt-0.5">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      formData.campaign_type === 'simple' ? "border-primary" : "border-border"
                    }`}>
                      {formData.campaign_type === 'simple' && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">⚡</span>
                      <span className="font-medium text-sm text-foreground">Disparo Direto</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Envia sequência automática de mensagens para todos os contatos, sem aguardar resposta
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    formData.campaign_type === 'interactive'
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => updateFormData("campaign_type", "interactive")}
                >
                  <div className="pt-0.5">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      formData.campaign_type === 'interactive' ? "border-primary" : "border-border"
                    }`}>
                      {formData.campaign_type === 'interactive' && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">💬</span>
                      <span className="font-medium text-sm text-foreground">Disparo com Interação</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Envia Mensagem 1, aguarda resposta, então envia Mensagem 2. Inicia follow-up se não houver resposta
                    </p>
                  </div>
                </label>
              </div>

              {/* Configurações de Interação */}
              {formData.campaign_type === 'interactive' && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border space-y-3">
                  <h4 className="text-xs font-medium text-foreground">Configurações de Interação</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="delay" className="text-xs">
                      Aguardar após resposta (segundos)
                    </Label>
                    <Input
                      id="delay"
                      type="number"
                      min="1"
                      value={formData.interaction_config.delay_after_response_seconds}
                      onChange={(e) => updateFormData("interaction_config", {
                        ...formData.interaction_config,
                        delay_after_response_seconds: parseInt(e.target.value) || 10
                      })}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Tempo de espera após receber resposta antes de enviar Mensagem 2
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeout" className="text-xs">
                      Timeout para follow-up (horas)
                    </Label>
                    <Input
                      id="timeout"
                      type="number"
                      min="1"
                      value={formData.interaction_config.timeout_hours}
                      onChange={(e) => updateFormData("interaction_config", {
                        ...formData.interaction_config,
                        timeout_hours: parseInt(e.target.value) || 24
                      })}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Se não houver resposta após este período, o follow-up automático será iniciado
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* Conexões Disponíveis */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Conexões disponíveis *</h3>
                  <p className="text-xs text-muted-foreground">
                    Selecione uma ou mais conexões para o disparo. O sistema alternará entre as conexões selecionadas.
                  </p>
                </div>
                {connectedConnections.length > 0 && (
                  <span className="text-xs text-primary px-2 py-1 bg-primary/10 rounded">
                    Concluídas atrás
                  </span>
                )}
              </div>

              {connectedConnections.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conexão disponível</p>
              ) : (
                <div className="space-y-2">
                  {connectedConnections.map((conn) => (
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
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">📱</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground">{conn.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{conn.phone_number || "Sem número"}</div>
                      </div>
                      {conn.status === "connected" && (
                        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                      )}
                    </label>
                  ))}
                  
                  {formData.connection_ids.length > 1 && (
                    <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                      <p className="text-xs text-foreground">
                        <span className="font-medium">🎲 Alternância aleatória ativada:</span> Os disparos serão distribuídos aleatoriamente entre as {formData.connection_ids.length} conexões selecionadas para evitar padrões detectáveis.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Listas de Contatos */}
            <Collapsible open={listsOpen} onOpenChange={setListsOpen}>
              <Card className="p-4">
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <div>
                    <h3 className="text-sm font-medium text-foreground text-left">
                      Listas de contatos disponíveis *
                    </h3>
                    <p className="text-xs text-muted-foreground text-left">
                      Selecione uma ou mais listas de contatos para o disparo
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {formData.list_ids.length > 0 && (
                      <span className="text-xs text-primary px-2 py-1 bg-primary/10 rounded">
                        {formData.list_ids.length} selecionada{formData.list_ids.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {listsOpen ? "Ocultar" : "Expandir"}
                    </span>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="space-y-3 mt-4">
                  {lists.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma lista disponível</p>
                  ) : (
                    <div className="space-y-2">
                      {lists.map((list) => (
                        <label
                          key={list.id}
                          className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:border-primary/50 transition-colors"
                        >
                          <Checkbox
                            checked={formData.list_ids.includes(list.id)}
                            onCheckedChange={() => toggleList(list.id)}
                          />
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-lg">📋</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-foreground">{list.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {list.total_contacts || 0} contatos
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Mensagens */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-border" />
                <h3 className="text-sm font-medium text-foreground px-3">Mensagens do Disparo *</h3>
                <div className="h-px flex-1 bg-border" />
              </div>
              
              <p className="text-xs text-center text-muted-foreground mb-4">
                {formData.campaign_type === 'interactive' ? (
                  <>
                    <strong>Mensagem 1</strong> será enviada para todos os contatos. 
                    <strong> Mensagem 2</strong> só será enviada automaticamente para quem responder à Mensagem 1 
                    (após {formData.interaction_config.delay_after_response_seconds}s de espera).
                    Cada mensagem será escolhida aleatoriamente entre as variações que você criar.
                  </>
                ) : (
                  <>
                    O sistema enviará <strong>2 mensagens seguidas</strong> para cada contato: Mensagem 1 seguida pela Mensagem 2 (picotada).
                    Cada uma será escolhida aleatoriamente entre as variações que você criar.
                  </>
                )}
              </p>

              <MessageGroup
                title="Mensagem 1"
                description="Mensagem de abertura (até 7 variações)"
                messages={message1}
                onMessagesChange={setMessage1}
                onGenerateAI={() => openAIDialog(1)}
                badgeColor="bg-primary"
                badgeText="Mensagem Principal"
              />

              <MessageGroup
                title="Mensagem 2 (Picotada)"
                description="Enviada logo após a Mensagem 1 (até 7 variações)"
                messages={message2}
                onMessagesChange={setMessage2}
                onGenerateAI={() => openAIDialog(2)}
                badgeColor="bg-secondary"
                badgeText="Mensagem Picotada"
              />
            </div>

            {/* Configurações Avançadas */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <Card className="p-4">
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <h3 className="text-sm font-medium text-foreground">⚙️ Configurações avançadas</h3>
                  <span className="text-xs text-muted-foreground">
                    {advancedOpen ? "Ocultar" : "Expandir"}
                  </span>
                </CollapsibleTrigger>

                <CollapsibleContent className="space-y-6 mt-4">
                  {/* Agendar Disparo */}
                  <div className="space-y-3 p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium border-l-4 border-primary pl-3">
                        Agendar disparo
                      </Label>
                      <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
                    </div>
                    {scheduleEnabled && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Data e hora do início do disparo
                        </Label>
                        <Input
                          type="datetime-local"
                          value={formData.scheduled_at || ""}
                          onChange={(e) => updateFormData("scheduled_at", e.target.value)}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                          O disparo começará automaticamente nesta data e hora, respeitando os horários e dias permitidos configurados abaixo.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Intervalo entre mensagens */}
                  <div className="space-y-3 p-4 border border-border rounded-lg">
                    <Label className="text-sm font-medium border-l-4 border-primary pl-3">
                      Intervalo entre mensagens
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={formData.min_interval_seconds}
                        onChange={(e) => updateFormData("min_interval_seconds", parseInt(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">e</span>
                      <Input
                        type="number"
                        value={formData.max_interval_seconds}
                        onChange={(e) => updateFormData("max_interval_seconds", parseInt(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">segundos</span>
                    </div>
                  </div>

                  {/* Pausa automática */}
                  <div className="space-y-3 p-4 border border-border rounded-lg">
                    <Label className="text-sm font-medium border-l-4 border-primary pl-3">
                      Pausa automática
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Após</span>
                      <Input
                        type="number"
                        value={formData.pause_after_messages}
                        onChange={(e) => updateFormData("pause_after_messages", parseInt(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">mensagens, aguardar</span>
                      <Input
                        type="number"
                        value={formData.pause_duration_minutes}
                        onChange={(e) => updateFormData("pause_duration_minutes", parseInt(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">minutos</span>
                    </div>
                  </div>

                  {/* Horário de envio */}
                  <div className="space-y-3 p-4 border border-border rounded-lg">
                    <Label className="text-sm font-medium border-l-4 border-primary pl-3">
                      Horário de envio
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={formData.allowed_hours_start}
                        onChange={(e) => updateFormData("allowed_hours_start", e.target.value)}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">às</span>
                      <Input
                        type="time"
                        value={formData.allowed_hours_end}
                        onChange={(e) => updateFormData("allowed_hours_end", e.target.value)}
                        className="w-32"
                      />
                    </div>
                  </div>

                  {/* Dias da semana */}
                  <div className="space-y-3 p-4 border border-border rounded-lg">
                    <Label className="text-sm font-medium border-l-4 border-primary pl-3">
                      Dias da semana
                    </Label>
                    <DaySelector selectedDays={formData.allowed_days} onToggle={toggleDay} />
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Follow-up Manager */}
            <FollowUpManager
              enabled={followUpEnabled}
              onEnabledChange={setFollowUpEnabled}
              steps={followUpSteps}
              onStepsChange={setFollowUpSteps}
              onGenerateAI={openAIDialog}
            />

            {/* Botão Iniciar */}
            <Button
              onClick={handleSubmit}
              disabled={createCampaign.isPending}
              className="w-full h-12 text-base bg-primary hover:bg-primary/90"
            >
              {createCampaign.isPending ? "Iniciando..." : "Iniciar Disparo"}
            </Button>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">
                  {message1.filter(m => m.text.trim()).length + message2.filter(m => m.text.trim()).length}
                </div>
                <div className="text-xs text-muted-foreground">Total de Variações</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{totalContacts}</div>
                <div className="text-xs text-muted-foreground">Contatos Selecionados</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{formData.list_ids.length}</div>
                <div className="text-xs text-muted-foreground">Listas Selecionadas</div>
              </Card>
            </div>
          </div>

          {/* Right Column - WhatsApp Preview */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Preview - Mensagem 1</h3>
              <WhatsAppPreview messages={message1} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Preview - Mensagem 2</h3>
              <WhatsAppPreview messages={message2} />
            </div>
          </div>
        </div>
      </div>

      {/* AI Generation Dialog */}
      <AIGenerationDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        onVariationsGenerated={handleAIVariations}
      />
    </div>
  );
}
