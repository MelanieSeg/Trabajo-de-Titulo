import { Target, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

export default function Objetivos() {
  const { data, isLoading, isError } = useOperationsOverview();
  const goals = data?.goals ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Objetivos Energéticos</h2>
          <p className="text-sm text-muted-foreground">Seguimiento de metas de eficiencia y sostenibilidad</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando objetivos...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar objetivos.</Card>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((goal) => (
            <Card key={goal.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    {goal.name}
                  </CardTitle>
                  <Badge variant="secondary">{goal.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>
                    Actual: {goal.current.toLocaleString("es-CL", { maximumFractionDigits: 2 })} {goal.unit}
                  </span>
                  <span>
                    Meta: {goal.target.toLocaleString("es-CL", { maximumFractionDigits: 2 })} {goal.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>{goal.progress.toFixed(1)}% completado</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {goal.deadline ?? "Sin fecha"}
                  </span>
                </div>
                <Progress value={goal.progress} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
