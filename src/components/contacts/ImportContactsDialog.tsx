import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Phone, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

interface ImportContactsDialogProps {
  listId: string;
  onSuccess: () => void;
}

interface PreviewContact {
  name: string;
  phones: string[];
  [key: string]: string | string[];
}

interface ColumnMapping {
  nameColumn: string | null;
  usePhoneAsName: boolean;
  phoneColumns: string[];
}

interface ContactData {
  name: string;
  phones: string[];
  customData: { [key: string]: string };
}

export const ImportContactsDialog = ({ listId, onSuccess }: ImportContactsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [mapping, setMapping] = useState<ColumnMapping>({
    nameColumn: null,
    usePhoneAsName: false,
    phoneColumns: [],
  });
  const [preview, setPreview] = useState<PreviewContact[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Padrões expandidos de detecção automática
  const isLikelyPhoneColumn = (header: string): boolean => {
    const normalized = header.toLowerCase().trim();
    const phonePatterns = [
      /^(telefone|phone|whatsapp|celular|cel|fone|mobile|contato|tel|numero|número)$/i,
      /^(telefone|phone|whatsapp|celular|cel|fone|mobile|contato|tel)[_\-\s]?\d*$/i,
      /^(fone|tel|contato)\d+$/i,
    ];
    return phonePatterns.some(pattern => pattern.test(normalized));
  };

  const isLikelyNameColumn = (header: string): boolean => {
    const normalized = header.toLowerCase().trim();
    const namePatterns = [
      /^(name|nome|cliente|empresa|razao\s*social|razão\s*social|fantasia|nome\s*fantasia)$/i,
    ];
    return namePatterns.some(pattern => pattern.test(normalized));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo CSV",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);

    // Parse CSV
    const text = await selectedFile.text();
    const lines = text.split("\n").filter((line) => line.trim());

    if (lines.length < 2) {
      toast({
        title: "Arquivo vazio",
        description: "O arquivo deve conter pelo menos o cabeçalho e uma linha de dados",
        variant: "destructive",
      });
      return;
    }

    const headers = lines[0].split(",").map((h) => h.trim());
    const data: string[][] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      data.push(values);
    }

    setColumns(headers);
    setRawData(data);

    // Auto-detectar colunas
    const autoDetectedPhones = headers.filter(h => isLikelyPhoneColumn(h));
    const autoDetectedName = headers.find(h => isLikelyNameColumn(h)) || null;

    setMapping({
      nameColumn: autoDetectedName,
      usePhoneAsName: false,
      phoneColumns: autoDetectedPhones.slice(0, 3), // máximo 3
    });

    setStep('mapping');
  };

  const handleMappingConfirm = () => {
    if (mapping.phoneColumns.length === 0) {
      toast({
        title: "Selecione pelo menos um telefone",
        description: "É necessário selecionar pelo menos uma coluna de telefone",
        variant: "destructive",
      });
      return;
    }

    // Gerar preview com base no mapeamento
    const previewData: PreviewContact[] = [];
    const maxPreview = Math.min(5, rawData.length);

    for (let i = 0; i < maxPreview; i++) {
      const row = rawData[i];
      const contact: PreviewContact = { name: '', phones: [] };

      // Nome
      if (mapping.usePhoneAsName) {
        const firstPhoneIdx = columns.indexOf(mapping.phoneColumns[0]);
        contact.name = firstPhoneIdx !== -1 ? row[firstPhoneIdx] || '' : '';
      } else if (mapping.nameColumn) {
        const nameIdx = columns.indexOf(mapping.nameColumn);
        contact.name = nameIdx !== -1 ? row[nameIdx] || '' : '';
      }

      // Telefones
      for (const phoneCol of mapping.phoneColumns) {
        const phoneIdx = columns.indexOf(phoneCol);
        if (phoneIdx !== -1 && row[phoneIdx]) {
          contact.phones.push(row[phoneIdx]);
        }
      }

      // Outros campos (campos personalizados)
      columns.forEach((col, idx) => {
        if (col !== mapping.nameColumn && !mapping.phoneColumns.includes(col)) {
          contact[col] = row[idx] || '';
        }
      });

      previewData.push(contact);
    }

    setPreview(previewData);
    setStep('preview');
  };

  const validatePhone = (phone: string): boolean => {
    const cleanPhone = phone.replace(/\D/g, "");
    return cleanPhone.length >= 10;
  };

  const normalizePhone = (phone: string): string => {
    return phone.replace(/\D/g, "");
  };

  const handlePhoneColumnToggle = (col: string, checked: boolean) => {
    if (checked && mapping.phoneColumns.length < 3) {
      setMapping(prev => ({
        ...prev,
        phoneColumns: [...prev.phoneColumns, col],
      }));
    } else if (!checked) {
      setMapping(prev => ({
        ...prev,
        phoneColumns: prev.phoneColumns.filter(c => c !== col),
      }));
    }
  };

  const getCustomFieldColumns = () => {
    return columns.filter(col => 
      col !== mapping.nameColumn && !mapping.phoneColumns.includes(col)
    );
  };

  const handleImport = async () => {
    if (!file || mapping.phoneColumns.length === 0) return;

    setIsImporting(true);
    setImportProgress(10);

    try {
      // Índices das colunas mapeadas
      const nameIdx = mapping.nameColumn ? columns.indexOf(mapping.nameColumn) : -1;
      const phoneIndices = mapping.phoneColumns.map(col => columns.indexOf(col));
      
      // Campos personalizados
      const customFieldColumns = getCustomFieldColumns();

      setImportProgress(20);

      // Processar dados localmente
      const processedContacts: ContactData[] = [];
      let skippedInvalid = 0;

      for (const row of rawData) {
        // Coletar todos os telefones válidos desta linha
        const validPhones: string[] = [];
        for (const phoneIdx of phoneIndices) {
          const rawPhone = row[phoneIdx];
          if (rawPhone) {
            const normalized = normalizePhone(rawPhone);
            if (validatePhone(normalized) && !validPhones.includes(normalized)) {
              validPhones.push(normalized);
            }
          }
        }

        if (validPhones.length === 0) {
          skippedInvalid++;
          continue;
        }

        // Determinar o nome
        let name: string;
        if (mapping.usePhoneAsName) {
          name = validPhones[0];
        } else if (nameIdx !== -1 && row[nameIdx]) {
          name = row[nameIdx];
        } else {
          name = validPhones[0]; // fallback
        }

        // Coletar dados customizados
        const customData: { [key: string]: string } = {};
        for (const col of customFieldColumns) {
          const colIdx = columns.indexOf(col);
          if (colIdx !== -1 && row[colIdx]) {
            customData[col.toLowerCase()] = row[colIdx];
          }
        }

        processedContacts.push({
          name,
          phones: validPhones,
          customData,
        });
      }

      setImportProgress(40);

      console.log(`Processed ${processedContacts.length} contacts locally, ${skippedInvalid} invalid`);

      // Chamar edge function para importação em lote
      const { data, error } = await supabase.functions.invoke('import-contacts-batch', {
        body: {
          listId,
          contacts: processedContacts,
          customFieldColumns,
        },
      });

      setImportProgress(90);

      if (error) {
        throw new Error(error.message || 'Erro na importação');
      }

      setImportProgress(100);

      const messages = [
        `${data.imported} contatos importados`,
        `${data.totalPhones} telefones salvos`,
      ];
      
      if (data.chipsInherited > 0) {
        messages.push(`${data.chipsInherited} herdaram chip oficial`);
      }
      if (data.duplicates > 0) {
        messages.push(`${data.duplicates} duplicados ignorados`);
      }
      if (skippedInvalid > 0) {
        messages.push(`${skippedInvalid} inválidos`);
      }

      toast({
        title: "Importação concluída!",
        description: messages.join(". ") + ".",
      });

      resetState();
      onSuccess();
    } catch (error) {
      console.error("Error importing contacts:", error);
      toast({
        title: "Erro na importação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const resetState = () => {
    setOpen(false);
    setFile(null);
    setRawData([]);
    setColumns([]);
    setStep('upload');
    setMapping({ nameColumn: null, usePhoneAsName: false, phoneColumns: [] });
    setPreview([]);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetState();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
          <Upload className="mr-2 h-4 w-4" />
          Importar Contatos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {step === 'upload' && 'Importar Contatos'}
            {step === 'mapping' && 'Mapear Colunas'}
            {step === 'preview' && 'Confirmar Importação'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {step === 'upload' && 'Selecione um arquivo CSV para importar.'}
            {step === 'mapping' && 'Defina quais colunas correspondem a cada campo.'}
            {step === 'preview' && 'Revise os dados antes de importar.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Selecione um arquivo CSV para importar</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Selecionar Arquivo
              </Button>
            </div>
          )}

          {/* STEP 2: Mapping */}
          {step === 'mapping' && (
            <div className="space-y-6">
              {/* Arquivo selecionado */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{file?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {columns.length} colunas • {rawData.length} linhas
                    </p>
                  </div>
                </div>
                <Button variant="ghost" onClick={resetState}>
                  Trocar arquivo
                </Button>
              </div>

              {/* Mapeamento de Nome */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Nome do Contato</Label>
                <Select 
                  value={mapping.nameColumn || "none"} 
                  onValueChange={(val) => setMapping(prev => ({
                    ...prev,
                    nameColumn: val === "none" ? null : val,
                    usePhoneAsName: false,
                  }))}
                  disabled={mapping.usePhoneAsName}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar coluna..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma coluna</SelectItem>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="usePhoneAsName" 
                    checked={mapping.usePhoneAsName}
                    onCheckedChange={(checked) => setMapping(prev => ({
                      ...prev,
                      usePhoneAsName: checked === true,
                      nameColumn: checked ? null : prev.nameColumn,
                    }))}
                  />
                  <Label htmlFor="usePhoneAsName" className="text-sm text-muted-foreground cursor-pointer">
                    Usar telefone como nome (para listas sem nomes)
                  </Label>
                </div>
              </div>

              {/* Mapeamento de Telefones */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Colunas de Telefone</Label>
                  <Badge variant="outline">
                    {mapping.phoneColumns.length}/3 selecionadas
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 p-4 bg-muted/50 rounded-lg">
                  {columns.map(col => (
                    <div key={col} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`phone-${col}`}
                        checked={mapping.phoneColumns.includes(col)}
                        onCheckedChange={(checked) => handlePhoneColumnToggle(col, checked === true)}
                        disabled={!mapping.phoneColumns.includes(col) && mapping.phoneColumns.length >= 3}
                      />
                      <Label 
                        htmlFor={`phone-${col}`} 
                        className={`text-sm cursor-pointer ${isLikelyPhoneColumn(col) ? 'text-primary font-medium' : ''}`}
                      >
                        {col}
                        {isLikelyPhoneColumn(col) && (
                          <Phone className="inline h-3 w-3 ml-1" />
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  A primeira coluna selecionada será o telefone principal. Máximo de 3 colunas.
                </p>
              </div>

              {/* Campos Personalizados */}
              {getCustomFieldColumns().length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Campos personalizados (salvos automaticamente)
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {getCustomFieldColumns().map(col => (
                      <Badge key={col} variant="secondary">{col}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Botões de navegação */}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={resetState}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button onClick={handleMappingConfirm} disabled={mapping.phoneColumns.length === 0}>
                  Continuar
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Resumo do mapeamento */}
              <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <Phone className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-primary">
                    Mapeamento configurado
                  </p>
                  <p className="text-muted-foreground">
                    Nome: {mapping.usePhoneAsName ? 'Telefone' : (mapping.nameColumn || 'Nenhum')} • 
                    Telefones: {mapping.phoneColumns.join(", ")}
                  </p>
                </div>
              </div>

              {/* Tabela de preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Preview (primeiros 5 contatos)</h3>
                  <Badge variant="secondary">{rawData.length} total</Badge>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">Nome</TableHead>
                        <TableHead className="font-semibold">Telefones</TableHead>
                        {getCustomFieldColumns().slice(0, 3).map((col) => (
                          <TableHead key={col} className="font-semibold">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.map((contact, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {contact.name || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {contact.phones.map((phone, j) => (
                                <Badge 
                                  key={j} 
                                  variant={j === 0 ? "default" : "outline"}
                                  className="text-xs"
                                >
                                  {phone}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          {getCustomFieldColumns().slice(0, 3).map((col) => (
                            <TableCell key={col} className="text-sm">
                              {typeof contact[col] === 'string' ? contact[col] : '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Aviso de formato */}
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-600 dark:text-blue-400">Formato de telefone</p>
                  <p className="text-muted-foreground">
                    Apenas números serão considerados (mínimo 10 dígitos). Exemplo: 5577981035622
                  </p>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao mapeamento
                </Button>
                {isImporting ? (
                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Importando contatos...</span>
                    </div>
                    <Progress value={importProgress} className="h-2" />
                  </div>
                ) : (
                  <Button
                    onClick={handleImport}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Importar {rawData.length} Contatos
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
