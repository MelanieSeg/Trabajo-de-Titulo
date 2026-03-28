import { Zap, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";

const monthlyData = [
  { mes: "Ene", consumo: 4800, costo: 7200 },
  { mes: "Feb", consumo: 4600, costo: 6900 },
  { mes: "Mar", consumo: 5100, costo: 7650 },
  { mes: "Abr", consumo: 5300, costo: 7950 },
  { mes: "May", consumo: 5500, costo: 8250 },
  { mes: "Jun", consumo: 5800, costo: 8700 },
  { mes: "Jul", consumo: 6200, costo: 9300 },
  { mes: "Ago", consumo: 5900, costo: 8850 },
  { mes: "Sep", consumo: 5500, costo: 8250 },
];

const areaData = [
  { area: "Iluminación", consumo: 1800 },
  { area: "Climatización", consumo: 2200 },
  { area: "Maquinaria", consumo: 900 },
  { area: "Oficinas", consumo: 400 },
  { area: "Otros", consumo: 200 },
];

const chartConfig = {
  consumo: { label: "Consumo (kWh)", color: "hsl(var(--chart-1))" },
  costo: { label: "Costo (USD)", color: "hsl(var(--chart-2))" },
};

const barConfig = {
  consumo: { label: "Consumo (kWh)", color: "hsl(var(--chart-1))" },
};

export default function Electricidad() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Consumo Eléctrico</h2>
          <p className="text-sm text-muted-foreground">Análisis detallado del consumo de electricidad</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Consumo Actual", value: "5,500 kWh", icon: Zap, change: "+5.2%", up: true },
            { label: "Costo Mensual", value: "$8,250", icon: TrendingUp, change: "+8.7%", up: true },
            { label: "vs. Mes Anterior", value: "-400 kWh", icon: TrendingDown, change: "-6.8%", up: false },
          ].map((m) => (
            <Card key={m.label}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <m.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-bold">{m.value}</p>
                  <p className={`text-xs ${m.up ? "text-destructive" : "text-green-600"}`}>{m.change}</p>
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
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="consumo" fill="var(--color-consumo)" fillOpacity={0.3} stroke="var(--color-consumo)" />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Consumo por Área</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={barConfig} className="h-[300px] w-full">
                <BarChart data={areaData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="area" />
                  <YAxis />
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