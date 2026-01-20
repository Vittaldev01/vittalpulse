import { Button } from "@/components/ui/button";

const DAYS = [
  { id: "monday", label: "SEG", fullLabel: "Segunda" },
  { id: "tuesday", label: "TER", fullLabel: "Terça" },
  { id: "wednesday", label: "QUA", fullLabel: "Quarta" },
  { id: "thursday", label: "QUI", fullLabel: "Quinta" },
  { id: "friday", label: "SEX", fullLabel: "Sexta" },
  { id: "saturday", label: "SÁB", fullLabel: "Sábado" },
  { id: "sunday", label: "DOM", fullLabel: "Domingo" },
];

interface DaySelectorProps {
  selectedDays: string[];
  onToggle: (day: string) => void;
}

export function DaySelector({ selectedDays, onToggle }: DaySelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {DAYS.map((day) => {
        const isSelected = selectedDays.includes(day.id);
        return (
          <Button
            key={day.id}
            type="button"
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onToggle(day.id)}
            className="min-w-[60px]"
            title={day.fullLabel}
          >
            {day.label}
          </Button>
        );
      })}
    </div>
  );
}
