import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

const chartConfig = {
  sinSoftware: { label: "Sin software (USD)", color: "hsl(var(--chart-1))" },
  conSoftware: { label: "Con software / optimizado (USD)", color: "hsl(var(--chart-2))" },
  ahorro: { label: "Ahorro anual (USD)", color: "hsl(var(--chart-3))" },
};

export default function Comparativas() {
  const { data, isLoading, isError } = useOperationsOverview();
  const comparisons = data?.comparisons;
  const compareData = (comparisons?.rows ?? []).map((row) => ({
    periodo: row.periodo,
    sinSoftware: row.total_cost_without_software_usd,
    conSoftware: row.total_cost_with_software_usd,
    ahorro: row.projected_savings_usd,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Comparativas</h2>
          <p className="text-sm text-muted-foreground">Comparación anual: escenario sin software vs optimizado/predictivo</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando comparativas...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar comparativas.</Card>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Inicio software energético</p>
              <p className="text-xl font-bold">{comparisons?.software_start_year ?? "N/D"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Ahorro histórico acumulado</p>
              <p className="text-xl font-bold">
                ${(comparisons?.summary.historical_savings_usd ?? 0).toLocaleString("es-CL")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Ahorro futuro proyectado</p>
              <p className="text-xl font-bold">
                ${(comparisons?.summary.future_savings_usd ?? 0).toLocaleString("es-CL")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Mejora media: {(comparisons?.summary.avg_future_savings_pct ?? 0).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Costo Total Anual</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <BarChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="sinSoftware" fill="var(--color-sinSoftware)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="conSoftware" fill="var(--color-conSoftware)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ahorro Anual</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="ahorro" fill="var(--color-ahorro)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
