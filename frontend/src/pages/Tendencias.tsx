import { TrendingUp } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

const trendData = [
  { mes: "Ene", electricidad: 4800, agua: 2200 },
  { mes: "Feb", electricidad: 4600, agua: 2100 },
  { mes: "Mar", electricidad: 5100, agua: 2400 },
  { mes: "Abr", electricidad: 5300, agua: 2500 },
  { mes: "May", electricidad: 5500, agua: 2700 },
  { mes: "Jun", electricidad: 5800, agua: 2900 },
  { mes: "Jul", electricidad: 6200, agua: 3100 },
  { mes: "Ago", electricidad: 5900, agua: 2800 },
  { mes: "Sep", electricidad: 5500, agua: 2600 },
];

const chartConfig = {
  electricidad: { label: "Electricidad (kWh)", color: "hsl(var(--chart-1))" },
  agua: { label: "Agua (m³)", color: "hsl(var(--chart-2))" },
};

export default function Tendencias() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Análisis de Tendencias</h2>
          <p className="text-sm text-muted-foreground">Evolución histórica del consumo energético e hídrico</p>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Tendencia Anual Comparativa</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" /><YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="electricidad" stroke="var(--color-electricidad)" strokeWidth={2} />
                <Line type="monotone" dataKey="agua" stroke="var(--color-agua)" strokeWidth={2} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-yellow-500" /><span className="text-sm font-medium">Electricidad</span></div>
            <p className="text-xs text-muted-foreground">Tendencia al alza de +14.6% en los últimos 9 meses. Pico máximo en Julio con 6,200 kWh.</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-blue-500" /><span className="text-sm font-medium">Agua</span></div>
            <p className="text-xs text-muted-foreground">Incremento de +18.2% interanual. Mayor consumo en meses de verano (Jun-Ago).</p>
          </CardContent></Card>
        </div>
      </div>
    </DashboardLayout>
  );
}