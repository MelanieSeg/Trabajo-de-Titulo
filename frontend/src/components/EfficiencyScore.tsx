import { Leaf } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EfficiencyData } from "@/lib/api";

interface EfficiencyScoreProps {
  data: EfficiencyData;
}

const clampPercentage = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

export function EfficiencyScore({ data }: EfficiencyScoreProps) {
  const score = clampPercentage(data.score);

  return (
    <Card className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Leaf className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Índice de Eficiencia</h3>
      </div>
      <div className="text-center mb-4">
        <span className="text-4xl font-bold text-primary">{Math.round(score)}</span>
        <span className="text-lg text-muted-foreground">/100</span>
        <p className="text-xs text-muted-foreground mt-1">Puntuación general</p>
      </div>
      <div className="space-y-3">
        {data.items.map((item) => {
          const value = clampPercentage(item.value);

          return (
            <div key={item.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium text-foreground">
                  {Math.round(value)}%
                  <span className="text-muted-foreground"> / 100%</span>
                </span>
              </div>
              <Progress value={value} className="h-2" />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
