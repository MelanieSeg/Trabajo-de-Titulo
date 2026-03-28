import { Gauge, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const kpis = [
  { name: "kWh/m² mensual", value: "12.5", target: "10.0", status: "warning", trend: "up" },
  { name: "m³/empleado mensual", value: "3.2", target: "4.0", status: "good", trend: "down" },
  { name: "Costo energético/unidad producida", value: "$0.85", target: "$0.70", status: "critical", trend: "up" },
  { name: "% Energía renovable", value: "35%", target: "50%", status: "warning", trend: "up" },
  { name: "PUE (Power Usage Effectiveness)", value: "1.6", target: "1.4", status: "warning", trend: "stable" },
  { name: "Emisiones CO₂ (Ton/mes)", value: "1.2", target: "1.5", status: "good", trend: "down" },
  { name: "Tasa de reutilización de agua", value: "28%", target: "40%", status: "warning", trend: "up" },
  { name: "Tiempo medio entre fallas", value: "720h", target: "500h", status: "good", trend: "stable" },
];

const statusColors: Record<string, string> = {
  good: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  critical: "bg-red-100 text-red-800",
};

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-yellow-600" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-green-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

export default function KPIs() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Indicadores KPI</h2>
          <p className="text-sm text-muted-foreground">Key Performance Indicators del sistema energético</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-normal">{kpi.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{kpi.value}</span>
                  <TrendIcon trend={kpi.trend} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">Meta: {kpi.target}</span>
                  <Badge variant="secondary" className={statusColors[kpi.status]}>
                    {kpi.status === "good" ? "Bien" : kpi.status === "warning" ? "Alerta" : "Crítico"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}