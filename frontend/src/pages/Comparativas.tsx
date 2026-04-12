import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

const chartConfig = {
  electricidad: { label: "Electricidad (kWh)", color: "hsl(var(--chart-1))" },
  agua: { label: "Agua (m³)", color: "hsl(var(--chart-2))" },
};

export default function Comparativas() {
  const { data, isLoading, isError } = useOperationsOverview();
  const compareData = data?.comparisons ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Comparativas</h2>
          <p className="text-sm text-muted-foreground">Comparación de consumo entre períodos</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando comparativas...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar comparativas.</Card>}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparativa Trimestral</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <BarChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
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
