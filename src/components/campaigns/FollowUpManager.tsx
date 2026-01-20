import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { MessageGroup } from "./MessageGroup";

interface FollowUpStep {
  id: string;
  stepNumber: number;
  daysAfter: number;
  messages: Array<{
    text: string;
    media_url?: string;
    media_type?: "image" | "video" | "audio" | "document" | "none";
  }>;
}

interface FollowUpManagerProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  steps: FollowUpStep[];
  onStepsChange: (steps: FollowUpStep[]) => void;
  onGenerateAI: (stepId: string) => void;
}

export function FollowUpManager({
  enabled,
  onEnabledChange,
  steps,
  onStepsChange,
  onGenerateAI,
}: FollowUpManagerProps) {
  const [editingStep, setEditingStep] = useState<string | null>(null);

  const addStep = () => {
    if (steps.length >= 5) return;

    const newStep: FollowUpStep = {
      id: `step-${Date.now()}`,
      stepNumber: steps.length + 1,
      daysAfter: steps.length === 0 ? 2 : 3,
      messages: [{ text: "" }],
    };

    onStepsChange([...steps, newStep]);
  };

  const removeStep = (stepId: string) => {
    const updatedSteps = steps
      .filter(s => s.id !== stepId)
      .map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    onStepsChange(updatedSteps);
  };

  const updateStepDays = (stepId: string, days: number) => {
    const updatedSteps = steps.map(s =>
      s.id === stepId ? { ...s, daysAfter: days } : s
    );
    onStepsChange(updatedSteps);
  };

  const updateStepMessages = (stepId: string, messages: any[]) => {
    const updatedSteps = steps.map(s =>
      s.id === stepId ? { ...s, messages } : s
    );
    onStepsChange(updatedSteps);
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Follow-up Automático
            </CardTitle>
            <CardDescription>
              Configure mensagens de follow-up que serão enviadas automaticamente após dias específicos
            </CardDescription>
          </div>
          <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        </div>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-4">
          {steps.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Nenhum follow-up configurado ainda
              </p>
              <Button onClick={addStep} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Follow-up
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <Card key={step.id} className="border-border bg-muted/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-foreground">
                          Follow-up #{step.stepNumber}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStep(step.id)}
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`days-${step.id}`}>
                            Dias após {index === 0 ? 'envio inicial' : `follow-up #${index}`}
                          </Label>
                          <Input
                            id={`days-${step.id}`}
                            type="number"
                            min="1"
                            max="30"
                            value={step.daysAfter}
                            onChange={(e) => updateStepDays(step.id, parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Total de variações</Label>
                          <div className="h-10 px-3 py-2 rounded-md border border-border bg-background text-foreground">
                            {step.messages.filter(m => m.text.trim()).length} variações
                          </div>
                        </div>
                      </div>

                      {editingStep === step.id ? (
                        <div className="space-y-2">
                          <MessageGroup
                            title={`Mensagens do Follow-up #${step.stepNumber}`}
                            description="Configure até 7 variações para este follow-up"
                            messages={step.messages}
                            onMessagesChange={(messages) => updateStepMessages(step.id, messages)}
                            onGenerateAI={() => onGenerateAI(step.id)}
                            badgeColor="bg-blue-500"
                            badgeText={`Follow-up #${step.stepNumber}`}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingStep(null)}
                          >
                            Fechar Editor
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingStep(step.id)}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Editar Mensagens
                          </Button>
                          {step.messages[0]?.text && (
                            <div className="mt-2 p-3 bg-background rounded-md border border-border">
                              <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                              <p className="text-sm text-foreground">
                                {step.messages[0].text.substring(0, 100)}
                                {step.messages[0].text.length > 100 && '...'}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {steps.length < 5 && (
                <Button onClick={addStep} variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Follow-up ({steps.length}/5)
                </Button>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
