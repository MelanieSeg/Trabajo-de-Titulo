import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PERIOD_OPTIONS = [
  { label: "3 meses", value: 3 },
  { label: "6 meses", value: 6 },
  { label: "12 meses", value: 12 },
  { label: "24 meses", value: 24 },
  { label: "36 meses", value: 36 },
];

interface DateRangeFilterProps {
  selectedMonths: number;
  onMonthsChange: (months: number) => void;
}

export function DateRangeFilter({ selectedMonths, onMonthsChange }: DateRangeFilterProps) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium text-foreground">Período de análisis</label>
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={selectedMonths === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => onMonthsChange(option.value)}
              className="text-xs"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
