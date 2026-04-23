import { TrendingUp } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsumptionChart } from "@/components/ConsumptionChart";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

export default function Tendencias() {
  const { data, isLoading, isError } = useOperationsOverview();
  const chartData = data?.timeseries ?? [];
  const energyCatalog = data?.energy_catalog?.map((item) => ({
    code: item.code,
    label: item.label,
    unit: item.unit,
  }));
  const trendChanges = data?.trends.changes ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Análisis de Tendencias</h2>
          <p className="text-sm text-muted-foreground">Evolución histórica del consumo energético e hídrico</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando tendencias...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar tendencias.</Card>}

        <ConsumptionChart
          data={chartData}
          energyCatalog={energyCatalog}
          subtitle="Evolución histórica y proyección de todas las energías"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trendChanges.map((item) => (
            <Card key={item.code}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className={`h-4 w-4 ${item.change_pct > 0 ? "text-yellow-500" : "text-green-600"}`} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Variación del período: {item.change_pct.toFixed(1)}% ({item.unit}).
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.trends.insights ?? []).map((insight) => (
              <p key={insight} className="text-sm text-muted-foreground">
                {insight}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
