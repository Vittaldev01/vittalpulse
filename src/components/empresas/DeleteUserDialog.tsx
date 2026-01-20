import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  userEmail: string;
  onConfirm: () => void;
}

export const DeleteUserDialog = ({
  open,
  onOpenChange,
  userName,
  userEmail,
  onConfirm,
}: DeleteUserDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Tem certeza que deseja excluir o usuário <strong>{userName}</strong> ({userEmail})?
            </p>
            <p className="text-destructive">
              Esta ação é <strong>irreversível</strong> e removerá permanentemente:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 ml-2">
              <li>Perfil do usuário</li>
              <li>Permissões e roles</li>
              <li>Acesso ao sistema</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir Permanentemente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};