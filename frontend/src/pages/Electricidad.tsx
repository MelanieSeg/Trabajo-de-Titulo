import { Zap, TrendingUp, TrendingDown } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

const chartConfig = {
  consumo: {
    label: "Consumo (kWh)",
    theme: {
      light: "hsl(0 0% 12%)",
      dark: "hsl(0 0% 96%)",
    },
  },
  costo: {
    label: "Costo (USD)",
    theme: {
      light: "hsl(0 0% 12%)",
      dark: "hsl(0 0% 96%)",
    },
  },
};

const axisStroke = "hsl(var(--muted-foreground))";
const gridStroke = "hsl(var(--border))";
const tickStyle = { fill: "hsl(var(--foreground))", fontSize: 12 };

export default function Electricidad() {
  const { data, isLoading, isError } = useOperationsOverview();

  const cards = data?.electricity.cards ?? [];
  const monthlyData = data?.electricity.monthly ?? [];
  const areaData = data?.electricity.areas ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Consumo Eléctrico</h2>
          <p className="text-sm text-muted-foreground">Análisis detallado del consumo de electricidad</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando datos reales...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudo cargar la vista eléctrica.</Card>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map((metric, index) => {
            const Icon = index === 0 ? Zap : index === 1 ? TrendingUp : TrendingDown;
            return (
              <Card key={metric.label}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                    <p className="text-lg font-bold">
                      {metric.value.toLocaleString("es-CL", { maximumFractionDigits: 1 })} {metric.unit}
                    </p>
                    <p className={`text-xs ${metric.change_pct > 0 ? "text-destructive" : "text-green-600"}`}>
                      {metric.change_pct.toFixed(1)}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tendencia Mensual</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="mes" stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <YAxis stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="consumo"
                    fill="var(--color-consumo)"
                    fillOpacity={0.3}
                    stroke="var(--color-consumo)"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consumo por Área</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={areaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="area" stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <YAxis stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="consumo" fill="var(--color-consumo)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
