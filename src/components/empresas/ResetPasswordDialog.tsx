import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, KeyRound, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  userEmail: string;
  onConfirm: (newPassword: string) => void;
  isLoading?: boolean;
}

// Gerar senha aleatória segura
const generatePassword = (length: number = 12): string => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%&*";
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = "";
  // Garantir pelo menos um de cada tipo
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Preencher o resto
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Embaralhar
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

export const ResetPasswordDialog = ({
  open,
  onOpenChange,
  userName,
  userEmail,
  onConfirm,
  isLoading = false,
}: ResetPasswordDialogProps) => {
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGeneratePassword = () => {
    const password = generatePassword(12);
    setNewPassword(password);
    setShowPassword(true);
  };

  const handleCopyPassword = async () => {
    if (newPassword) {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      toast.success("Senha copiada!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirm = () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    onConfirm(newPassword);
  };

  const handleClose = () => {
    setNewPassword("");
    setShowPassword(false);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Resetar Senha
          </DialogTitle>
          <DialogDescription>
            Definir nova senha para <strong>{userName}</strong> ({userEmail})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova Senha</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite ou gere uma senha"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyPassword}
                disabled={!newPassword}
                title="Copiar senha"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={handleGeneratePassword}
            className="w-full"
          >
            <KeyRound className="h-4 w-4 mr-2" />
            Gerar Senha Aleatória
          </Button>

          {newPassword && (
            <p className="text-sm text-muted-foreground">
              <strong>Importante:</strong> Copie a senha antes de confirmar. Ela não poderá ser visualizada depois.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || !newPassword}>
            {isLoading ? "Resetando..." : "Confirmar Reset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
