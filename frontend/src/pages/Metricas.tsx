import {
  BarChart3,
  Cloud,
  Droplets,
  Factory,
  FlaskConical,
  Flame,
  Fuel,
  Leaf,
  TrendingDown,
  TrendingUp,
  Wind,
  Zap,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";
import { useState } from "react";

const iconMap: Record<string, typeof Zap> = {
  Electricidad: Zap,
  Agua: Droplets,
  "Gas Natural": Fuel,
  "Diésel": Factory,
  Gasolina: Flame,
  "GLP / Propano": Wind,
  "Vapor / Energía Térmica": Factory,
  "Energía Renovable Generada": Leaf,
  "Residuos Totales": Cloud,
  "Emisiones Reales de CO2e": Cloud,
  "Químicos y Consumibles": FlaskConical,
};

export default function Metricas() {
  const [months, setMonths] = useState(12);
  const { data, isLoading, isError } = useOperationsOverview(months);

  const energyCatalog = data?.energy_catalog ?? [];
  const kpis = data?.kpis ?? [];

  const energyMetrics = energyCatalog.map((energy) => {
    const kpi = kpis.find((item) => item.code === energy.code);
    return {
      code: energy.code,
      label: energy.label,
      unit: energy.unit,
      value: kpi?.value ?? 0,
      target: kpi?.target ?? 0,
      progress: kpi?.progress ?? 0,
      trend: kpi?.trend ?? "stable",
      status: kpi?.status ?? "warning",
    };
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Métricas Generales</h2>
          <p className="text-sm text-muted-foreground">Indicadores clave de rendimiento energético</p>
        </div>

        <DateRangeFilter selectedMonths={months} onMonthsChange={setMonths} />

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando métricas...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar métricas.</Card>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {energyMetrics.map((metric) => {
            const Icon = iconMap[metric.label] ?? BarChart3;
            return (
              <Card key={metric.code}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-sm">{metric.label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-2 flex items-end justify-between gap-2">
                    <span className="text-2xl font-bold">
                      {metric.value.toLocaleString("es-CL", { maximumFractionDigits: 2 })}{" "}
                      <span className="text-sm font-normal text-muted-foreground">{metric.unit}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Meta: {metric.target.toLocaleString("es-CL", { maximumFractionDigits: 2 })} {metric.unit}
                    </span>
                  </div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Cumplimiento: {metric.progress.toFixed(1)}%
                    </span>
                    <span className={metric.trend === "up" ? "text-energy-red" : metric.trend === "down" ? "text-energy-green" : "text-muted-foreground"}>
                      {metric.trend === "up" ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : metric.trend === "down" ? (
                        <TrendingDown className="h-3.5 w-3.5" />
                      ) : (
                        "Estable"
                      )}
                    </span>
                  </div>
                  <Progress value={metric.progress} className="h-2" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
