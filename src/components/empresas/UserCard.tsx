import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Mail, Building2, Shield, CheckCircle, XCircle, MoreVertical, Edit, KeyRound, Trash2, UserCheck, UserX, Calendar, Send } from "lucide-react";
import { useDeleteUser, useSendPasswordReset, useToggleUserApproval, useResetUserPassword } from "@/hooks/useSuperAdminUsers";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { format } from "date-fns";

interface UserCardProps {
  user: any;
  onEdit: () => void;
}

export const UserCard = ({ user, onEdit }: UserCardProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const deleteUser = useDeleteUser();
  const sendPasswordReset = useSendPasswordReset();
  const resetUserPassword = useResetUserPassword();
  const toggleApproval = useToggleUserApproval();

  const role = user.user_roles?.[0]?.role || "user";
  const empresaNome = user.empresas?.nome || "Sem empresa";
  
  const getRoleBadge = (role: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      super_admin: { label: "Super Admin", className: "bg-purple-500 text-white" },
      admin: { label: "Admin", className: "bg-blue-500 text-white" },
      user: { label: "Usuário", className: "bg-gray-500 text-white" },
    };
    const variant = variants[role] || variants.user;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const handleDelete = () => {
    deleteUser.mutate(user.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
      },
    });
  };

  const handleSendPasswordReset = () => {
    sendPasswordReset.mutate(user.email);
  };

  const handleResetPassword = (newPassword: string) => {
    resetUserPassword.mutate(
      { userId: user.id, newPassword },
      {
        onSuccess: () => {
          setResetPasswordDialogOpen(false);
        },
      }
    );
  };

  const handleToggleApproval = () => {
    toggleApproval.mutate({ userId: user.id, approved: !user.approved });
  };

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{user.full_name || "Sem nome"}</h3>
                    {role === "super_admin" && (
                      <Badge className="bg-purple-500 text-white">
                        Super Admin
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {user.email}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{empresaNome}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  {getRoleBadge(role)}
                </div>
                <div className="flex items-center gap-2">
                  {user.approved ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-green-600">Aprovado</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-red-600">Pendente</span>
                    </>
                  )}
                </div>
                {user.created_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Criado em {format(new Date(user.created_at), "dd/MM/yyyy")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <MoreVertical className="h-4 w-4" />
                  Ações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Usuário
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setResetPasswordDialogOpen(true)}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Resetar Senha
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSendPasswordReset}>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Email de Recuperação
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleApproval}>
                  {user.approved ? (
                    <>
                      <UserX className="h-4 w-4 mr-2" />
                      Reprovar Usuário
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 mr-2" />
                      Aprovar Usuário
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Usuário
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <DeleteUserDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        userName={user.full_name || "Usuário"}
        userEmail={user.email}
        onConfirm={handleDelete}
      />

      <ResetPasswordDialog
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
        userName={user.full_name || "Usuário"}
        userEmail={user.email}
        onConfirm={handleResetPassword}
        isLoading={resetUserPassword.isPending}
      />
    </>
  );
};