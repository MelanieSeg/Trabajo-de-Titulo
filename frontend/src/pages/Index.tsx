import { AlertCircle } from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";
import { ConsumptionChart } from "@/components/ConsumptionChart";
import { AlertsPanel } from "@/components/AlertsPanel";
import { DistributionChart } from "@/components/DistributionChart";
import { RecentActivity } from "@/components/RecentActivity";
import { QuickActions } from "@/components/QuickActions";
import { EfficiencyScore } from "@/components/EfficiencyScore";
import { EnergyMetricsCarousel } from "@/components/EnergyMetricsCarousel";
import { Card } from "@/components/ui/card";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

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
  const {
    data: dashboardData,
    isError: isDashboardError,
    error: dashboardError,
  } = useDashboardData(12);
  const {
    data: operationsData,
    isError: isOperationsError,
    error: operationsError,
  } = useOperationsOverview(12);

  const dashboard = dashboardData ?? defaultData;
  const summary = operationsData?.summary ?? dashboard.summary;
  const timeseries = operationsData?.timeseries ?? dashboard.timeseries;
  const energyCatalog = operationsData?.energy_catalog?.map((item) => ({
    code: item.code,
    label: item.label,
    unit: item.unit,
  }));
  const isError = isDashboardError || isOperationsError;
  const errorMessage =
    (operationsError instanceof Error && operationsError.message) ||
    (dashboardError instanceof Error && dashboardError.message) ||
    "intenta nuevamente";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Dashboard de Eficiencia Energética</h2>
          <p className="text-sm text-muted-foreground">
            Resumen general del consumo y predicciones — {summary.latest_month_label}
          </p>
        </div>

        {isError && (
          <Card className="p-4 border border-energy-red-light bg-energy-red-light/40">
            <div className="flex items-center gap-2 text-sm text-energy-red">
              <AlertCircle className="h-4 w-4" />
              Error cargando datos: {errorMessage}
            </div>
          </Card>
        )}

        <EnergyMetricsCarousel metrics={summary.metrics} />

        <QuickActions />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ConsumptionChart
              data={timeseries}
              energyCatalog={energyCatalog}
              subtitle="Todas las energías fiscalizadas y sus predicciones"
            />
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
