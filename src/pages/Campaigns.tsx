import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, MoreVertical, Play, Pause, StopCircle, Trash2 } from "lucide-react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useNavigate } from "react-router-dom";
import { CampaignTypeCell } from "@/components/campaigns/CampaignTypeCell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { useState } from "react";

const getStatusBadge = (status: string) => {
  const variants = {
    draft: { text: "Rascunho", className: "bg-secondary" },
    running: { text: "Em Execução", className: "bg-yellow-500 text-black" },
    paused: { text: "Pausada", className: "bg-yellow-400 text-black" },
    completed: { text: "Concluída", className: "bg-green-500 text-white" },
    cancelled: { text: "Cancelada", className: "bg-destructive" },
    scheduled: { text: "Agendada", className: "bg-purple-500 text-white" },
  };

  const config = variants[status as keyof typeof variants] || variants.draft;
  return <Badge className={config.className}>{config.text}</Badge>;
};

export default function Campaigns() {
  const { campaigns, isLoading, updateCampaignStatus, duplicateCampaign, deleteCampaign } = useCampaigns();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<{ id: string; name: string } | null>(null);

  const filteredCampaigns = campaigns.filter(campaign => {
    if (statusFilter === "all") return true;
    return campaign.status === statusFilter;
  });

  const handlePause = (id: string) => {
    updateCampaignStatus.mutate({ id, status: "paused" });
  };

  const handleResume = (id: string) => {
    updateCampaignStatus.mutate({ id, status: "running" });
  };

  const handleCancel = (id: string) => {
    if (confirm("Tem certeza que deseja cancelar esta campanha?")) {
      updateCampaignStatus.mutate({ id, status: "cancelled" });
    }
  };

  const handleDelete = (id: string, name: string) => {
    setCampaignToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (campaignToDelete) {
      deleteCampaign.mutate(campaignToDelete.id);
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    }
  };

  const handleRowClick = (campaignId: string) => {
    navigate(`/campaigns/${campaignId}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Histórico de Disparos</h1>
          <p className="text-muted-foreground">Gerencie e acompanhe suas campanhas</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => navigate("/campaigns/new")}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Campanha
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">Filtros</CardTitle>
            {statusFilter !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="scheduled">Agendada</SelectItem>
                  <SelectItem value="running">Em Execução</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Suas Campanhas</CardTitle>
            <CardDescription>Nenhuma campanha criada ainda</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Configure sua primeira campanha de disparo automatizado
              </p>
              <Button
                onClick={() => navigate("/campaigns/new")}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar Campanha
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Enviados</TableHead>
                  <TableHead className="text-right">Respostas</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.map((campaign) => {
                  const progress = campaign.total_messages > 0
                    ? (campaign.sent_messages / campaign.total_messages) * 100
                    : 0;

                  return (
                    <TableRow 
                      key={campaign.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(campaign.id)}
                    >
                      <TableCell className="font-medium">
                        {new Date(campaign.created_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {campaign.name}
                      </TableCell>
                  <TableCell>
                    <CampaignTypeCell 
                      campaign_type={campaign.campaign_type}
                      has_follow_up={campaign.has_follow_up}
                    />
                  </TableCell>
                      <TableCell className="text-right font-medium">
                        {campaign.total_messages}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-green-500">
                          {campaign.sent_messages}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {campaign.responses_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-12 text-right">
                            {progress.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(campaign.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(campaign.id);
                            }}>
                              Ver Detalhes
                            </DropdownMenuItem>
                            {campaign.status === "draft" && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/campaigns/${campaign.id}/edit`);
                              }}>
                                Editar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              duplicateCampaign.mutate(campaign.id);
                            }}>
                              Duplicar
                            </DropdownMenuItem>
                            {campaign.status === "running" && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handlePause(campaign.id);
                              }}>
                                <Pause className="h-4 w-4 mr-2" />
                                Pausar
                              </DropdownMenuItem>
                            )}
                            {campaign.status === "paused" && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleResume(campaign.id);
                              }}>
                                <Play className="h-4 w-4 mr-2" />
                                Retomar
                              </DropdownMenuItem>
                            )}
                            {(campaign.status === "running" || campaign.status === "paused") && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancel(campaign.id);
                                }}
                                className="text-destructive"
                              >
                                <StopCircle className="h-4 w-4 mr-2" />
                                Cancelar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(campaign.id, campaign.name);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* AlertDialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a campanha <strong>{campaignToDelete?.name}</strong>?
              <br/><br/>
              Todos os dados de histórico (mensagens enviadas, falhas, follow-ups) serão removidos permanentemente do banco de dados e do dashboard. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
