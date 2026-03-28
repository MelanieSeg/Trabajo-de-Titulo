import { Zap, Droplets, DollarSign, Leaf, LucideIcon, AlertCircle } from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { ConsumptionChart } from "@/components/ConsumptionChart";
import { AlertsPanel } from "@/components/AlertsPanel";
import { DistributionChart } from "@/components/DistributionChart";
import { RecentActivity } from "@/components/RecentActivity";
import { QuickActions } from "@/components/QuickActions";
import { EfficiencyScore } from "@/components/EfficiencyScore";
import { Card } from "@/components/ui/card";
import { useDashboardData } from "@/hooks/useDashboardData";

type MetricColor = "green" | "blue" | "yellow" | "red";

const metricVisuals: Record<string, { icon: LucideIcon; color: MetricColor }> = {
  Electricidad: { icon: Zap, color: "yellow" },
  Agua: { icon: Droplets, color: "blue" },
  "Costo Total": { icon: DollarSign, color: "red" },
  "CO₂ Evitado": { icon: Leaf, color: "green" },
};

const defaultData = {
  summary: {
    latest_month_label: "Sin datos",
    metrics: [
      { title: "Electricidad", value: 0, unit: "kWh", change_pct: 0 },
      { title: "Agua", value: 0, unit: "m³", change_pct: 0 },
      { title: "Costo Total", value: 0, unit: "USD", change_pct: 0 },
      { title: "CO₂ Evitado", value: 0, unit: "Ton", change_pct: 0 },
    ],
    open_alerts: 0,
  },
  timeseries: [],
  distribution: [],
  alerts: [],
  activity: [],
  efficiency: {
    score: 0,
    items: [
      { label: "Electricidad", value: 0, target: 85 },
      { label: "Agua", value: 0, target: 90 },
      { label: "Huella de Carbono", value: 0, target: 80 },
      { label: "Eficiencia General", value: 0, target: 85 },
    ],
  },
};

const Index = () => {
  const { data, isError, error } = useDashboardData(12);
  const dashboard = data ?? defaultData;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Dashboard de Eficiencia Energética</h2>
          <p className="text-sm text-muted-foreground">Resumen general del consumo y predicciones — {dashboard.summary.latest_month_label}</p>
        </div>

        {isError && (
          <Card className="p-4 border border-energy-red-light bg-energy-red-light/40">
            <div className="flex items-center gap-2 text-sm text-energy-red">
              <AlertCircle className="h-4 w-4" />
              Error cargando datos: {error instanceof Error ? error.message : "intenta nuevamente"}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {dashboard.summary.metrics.map((metric) => {
            const visual = metricVisuals[metric.title] ?? { icon: Zap, color: "green" as MetricColor };
            const formattedValue = metric.title === "Costo Total" ? metric.value.toLocaleString("es-CL") : metric.value.toLocaleString("es-CL");
            return (
              <MetricCard
                key={metric.title}
                title={metric.title}
                value={formattedValue}
                unit={metric.unit}
                change={metric.change_pct}
                icon={visual.icon}
                color={visual.color}
              />
            );
          })}
        </div>

        <QuickActions />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ConsumptionChart data={dashboard.timeseries} />
          </div>
          <DistributionChart data={dashboard.distribution} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <AlertsPanel alerts={dashboard.alerts} />
          <EfficiencyScore data={dashboard.efficiency} />
          <RecentActivity activities={dashboard.activity} />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
