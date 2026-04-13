import { TrendingUp } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsumptionChart } from "@/components/ConsumptionChart";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

export default function Tendencias() {
  const { data, isLoading, isError } = useOperationsOverview();
  const chartData = data?.timeseries ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Análisis de Tendencias</h2>
          <p className="text-sm text-muted-foreground">Evolución histórica del consumo energético e hídrico</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando tendencias...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar tendencias.</Card>}

        <ConsumptionChart data={chartData} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Electricidad</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Variación del período: {data?.trends.electricity_change_pct.toFixed(1) ?? "0.0"}%.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Agua</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Variación del período: {data?.trends.water_change_pct.toFixed(1) ?? "0.0"}%.
              </p>
            </CardContent>
          </Card>
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
