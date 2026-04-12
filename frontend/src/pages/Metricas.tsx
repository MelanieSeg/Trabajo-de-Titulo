import { BarChart3, Zap, Droplets, DollarSign, Leaf, Activity } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

const iconMap: Record<string, typeof Zap> = {
  Electricidad: Zap,
  Agua: Droplets,
  "Costo Total": DollarSign,
  "Huella de Carbono": Leaf,
  "Eficiencia General": Activity,
};

export default function Metricas() {
  const { data, isLoading, isError } = useOperationsOverview();

  const metrics = data?.metrics ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Métricas Generales</h2>
          <p className="text-sm text-muted-foreground">Indicadores clave de rendimiento energético</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando métricas...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar métricas.</Card>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric) => {
            const Icon = iconMap[metric.label] ?? BarChart3;
            return (
              <Card key={metric.label}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-sm">{metric.label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-2xl font-bold">{metric.value.toFixed(1)}%</span>
                    <span className="text-xs text-muted-foreground">Meta: {metric.target.toFixed(1)}%</span>
                  </div>
                  <Progress value={metric.value} className="h-2" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
