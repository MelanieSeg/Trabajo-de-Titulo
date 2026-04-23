import { Droplets, TrendingDown, DollarSign } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { useState } from "react";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

const chartConfig = {
  consumo: {
    label: "Consumo (m³)",
    color: "hsl(200 85% 48%)",
  },
  prediccion: {
    label: "Predicción (m³)",
    color: "hsl(160 60% 42%)",
  },
};

const axisStroke = "hsl(var(--muted-foreground))";
const gridStroke = "hsl(var(--border))";
const tickStyle = { fill: "hsl(var(--foreground))", fontSize: 12 };

export default function Agua() {
  const [months, setMonths] = useState(12);
  const { data, isLoading, isError } = useOperationsOverview(months);

  const cards = data?.water.cards ?? [];
  const monthlyData = data?.water.monthly ?? [];
  const areaData = data?.water.areas ?? [];
  const trendData = (data?.timeseries ?? []).map((item) => ({
    mes: item.label,
    consumo: item.energy_values?.water ?? item.water_m3,
    prediccion: item.energy_predictions?.water ?? item.predicted_water_m3,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Consumo de Agua</h2>
          <p className="text-sm text-muted-foreground">Análisis detallado del consumo hídrico</p>
        </div>

        <DateRangeFilter selectedMonths={months} onMonthsChange={setMonths} />

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando datos reales...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudo cargar la vista de agua.</Card>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map((metric, index) => {
            const icon = index === 0 ? Droplets : index === 1 ? DollarSign : TrendingDown;
            return (
              <Card key={metric.label}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    {icon === Droplets && <Droplets className="h-5 w-5 text-blue-500" />}
                    {icon === DollarSign && <DollarSign className="h-5 w-5 text-blue-500" />}
                    {icon === TrendingDown && <TrendingDown className="h-5 w-5 text-blue-500" />}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                    <p className="text-lg font-bold">
                      {metric.value.toLocaleString("es-CL", { maximumFractionDigits: 1 })} {metric.unit}
                    </p>
                    <p className={`text-xs ${metric.change_pct <= 0 ? "text-green-600" : "text-destructive"}`}>
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
                <LineChart data={trendData.length > 0 ? trendData : monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="mes" stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <YAxis stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="consumo"
                    stroke="var(--color-consumo)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="prediccion"
                    stroke="var(--color-prediccion)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    connectNulls
                  />
                </LineChart>
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
