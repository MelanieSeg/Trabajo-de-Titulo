import { Droplets, TrendingDown, DollarSign } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";

const monthlyData = [
  { mes: "Ene", consumo: 2200 }, { mes: "Feb", consumo: 2100 }, { mes: "Mar", consumo: 2400 },
  { mes: "Abr", consumo: 2500 }, { mes: "May", consumo: 2700 }, { mes: "Jun", consumo: 2900 },
  { mes: "Jul", consumo: 3100 }, { mes: "Ago", consumo: 2800 }, { mes: "Sep", consumo: 2600 },
];

const areaData = [
  { area: "Sanitarios", consumo: 800 }, { area: "Riego", consumo: 600 },
  { area: "Producción", consumo: 900 }, { area: "Limpieza", consumo: 200 }, { area: "Otros", consumo: 100 },
];

const chartConfig = { consumo: { label: "Consumo (m³)", color: "hsl(var(--chart-2))" } };

export default function Agua() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Consumo de Agua</h2>
          <p className="text-sm text-muted-foreground">Análisis detallado del consumo hídrico</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Consumo Actual", value: "2,600 m³", icon: Droplets, change: "-3.1%" },
            { label: "Costo Mensual", value: "$5,200", icon: DollarSign, change: "+2.1%" },
            { label: "Ahorro vs Meta", value: "-150 m³", icon: TrendingDown, change: "-5.4%" },
          ].map((m) => (
            <Card key={m.label}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <m.icon className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-bold">{m.value}</p>
                  <p className="text-xs text-muted-foreground">{m.change}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Tendencia Mensual</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" /><YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="consumo" fill="var(--color-consumo)" fillOpacity={0.3} stroke="var(--color-consumo)" />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Consumo por Área</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={areaData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="area" /><YAxis />
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