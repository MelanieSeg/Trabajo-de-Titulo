import { TrendingUp } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

const chartConfig = {
  electricidad: { label: "Electricidad (kWh)", color: "hsl(var(--chart-1))" },
  agua: { label: "Agua (m³)", color: "hsl(var(--chart-2))" },
};

export default function Tendencias() {
  const { data, isLoading, isError } = useOperationsOverview();
  const trendData = data?.trends.series ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Análisis de Tendencias</h2>
          <p className="text-sm text-muted-foreground">Evolución histórica del consumo energético e hídrico</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando tendencias...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar tendencias.</Card>}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tendencia Histórica Comparativa</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="electricidad" stroke="var(--color-electricidad)" strokeWidth={2} />
                <Line type="monotone" dataKey="agua" stroke="var(--color-agua)" strokeWidth={2} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

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
