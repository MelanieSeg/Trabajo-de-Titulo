import { PieChart as PieIcon } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const compareData = [
  { periodo: "Q1 2024", electricidad: 14500, agua: 6700 },
  { periodo: "Q2 2024", electricidad: 16200, agua: 7800 },
  { periodo: "Q3 2024", electricidad: 17800, agua: 8500 },
  { periodo: "Q4 2024", electricidad: 15600, agua: 7200 },
  { periodo: "Q1 2025", electricidad: 14800, agua: 6900 },
  { periodo: "Q2 2025", electricidad: 16500, agua: 8100 },
];

const chartConfig = {
  electricidad: { label: "Electricidad (kWh)", color: "hsl(var(--chart-1))" },
  agua: { label: "Agua (m³)", color: "hsl(var(--chart-2))" },
};

export default function Comparativas() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Comparativas</h2>
          <p className="text-sm text-muted-foreground">Comparación de consumo entre períodos y áreas</p>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Comparativa Trimestral</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <BarChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" /><YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="electricidad" fill="var(--color-electricidad)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="agua" fill="var(--color-agua)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}