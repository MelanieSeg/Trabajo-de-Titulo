import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

const statusColors: Record<string, string> = {
  good: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  critical: "bg-red-100 text-red-800",
};

const statusLabel: Record<string, string> = {
  good: "Bien",
  warning: "Alerta",
  critical: "Crítico",
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-yellow-600" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-green-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export default function KPIs() {
  const { data, isLoading, isError } = useOperationsOverview();

  const kpis = data?.kpis ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Indicadores KPI</h2>
          <p className="text-sm text-muted-foreground">Key Performance Indicators del sistema energético</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando KPIs...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar los KPIs.</Card>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-normal">{kpi.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {kpi.value.toLocaleString("es-CL", { maximumFractionDigits: 2 })}
                    <span className="text-sm font-normal ml-1 text-muted-foreground">{kpi.unit}</span>
                  </span>
                  <TrendIcon trend={kpi.trend} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    Meta: {kpi.target.toLocaleString("es-CL", { maximumFractionDigits: 2 })} {kpi.unit}
                  </span>
                  <Badge variant="secondary" className={statusColors[kpi.status]}>
                    {statusLabel[kpi.status]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
