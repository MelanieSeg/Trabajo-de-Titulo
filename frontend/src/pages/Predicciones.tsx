import { Brain, TrendingUp, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsumptionChart } from "@/components/ConsumptionChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";
import { runMlTraining } from "@/lib/api";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Predicciones() {
  const { data, isLoading, isError } = useOperationsOverview();
  const [training, setTraining] = useState(false);
  const queryClient = useQueryClient();

  const chartData = data?.timeseries ?? [];
  const energyCatalog = data?.energy_catalog?.map((item) => ({
    code: item.code,
    label: item.label,
    unit: item.unit,
  }));
  const recommendations = data?.predictions.recommendations ?? [];

  const retrainModel = async () => {
    try {
      setTraining(true);
      await runMlTraining(3);
      await queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      toast.success("Modelo reentrenado con éxito");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo reentrenar el modelo");
    } finally {
      setTraining(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Predicciones ML</h2>
            <p className="text-sm text-muted-foreground">Modelos de Machine Learning para pronóstico de consumo</p>
          </div>
          <Button onClick={retrainModel} disabled={training}>
            {training ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
            Reentrenar Modelo
          </Button>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando predicciones...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar predicciones.</Card>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Brain className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-xs text-muted-foreground">Precisión del Modelo</p>
              <p className="text-2xl font-bold">{(data?.predictions.accuracy_pct ?? 0).toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-xs text-muted-foreground">Ahorro Proyectado</p>
              <p className="text-2xl font-bold">${(data?.predictions.projected_savings_usd ?? 0).toLocaleString("es-CL")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-xs text-muted-foreground">Anomalías Activas</p>
              <p className="text-2xl font-bold">{data?.predictions.anomaly_count ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        <ConsumptionChart
          data={chartData}
          energyCatalog={energyCatalog}
          subtitle="Pronóstico multienergía con línea de predicción punteada"
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recomendaciones de Optimización</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.map((recommendation, index) => (
              <div key={`${recommendation.text}-${index}`} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm">{recommendation.text}</p>
                </div>
                <Badge variant={recommendation.type === "high" ? "destructive" : "secondary"}>
                  {recommendation.type === "high" ? "Alta" : recommendation.type === "medium" ? "Media" : "Baja"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
