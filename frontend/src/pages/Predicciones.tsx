import { Brain, TrendingUp, AlertTriangle, CheckCircle, Loader2, Fuel, TriangleAlert, ArrowRight, HelpCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";
import { PrediccionesMLSkeleton } from "@/components/skeletons/PageSkeleton";
import { runMlTraining, getAnalisisFlota, getModeloEstado, reentrenarCombustible, type AnalisisFlotaResult, type ModeloEstado } from "@/lib/api";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function Predicciones() {
  const { data, isLoading, isError } = useOperationsOverview();
  const [training, setTraining] = useState(false);
  const queryClient = useQueryClient();

  const { data: flota } = useQuery<AnalisisFlotaResult>({
    queryKey: ["analisis-flota"],
    queryFn: getAnalisisFlota,
    staleTime: 1000 * 60 * 5,
  });

  const { data: modeloEstado, refetch: refetchEstado } = useQuery<ModeloEstado>({
    queryKey: ["combustible-modelo-estado"],
    queryFn: getModeloEstado,
    staleTime: 1000 * 60,
  });

  const recommendations = data?.predictions.recommendations ?? [];

  const anomaliasAltas = flota?.anomalias.filter((a) => a.severidad === "alta").length ?? 0;
  const anomaliasTotales = flota?.registros_con_desvio ?? 0;

  const retrainModel = async () => {
    try {
      setTraining(true);

      // 1. Reentrenar modelos de electricidad, agua y tendencia de combustible
      await runMlTraining(3);

      // 2. Re-adaptar el modelo de viajes individuales si hay suficientes datos
      if (modeloEstado?.puede_reentrenar) {
        const res = await reentrenarCombustible();
        if (!res.success) {
          toast.warning(`Modelos E/A actualizados. Combustible: ${res.message ?? "no adaptado"}`);
        } else {
          toast.success("Todos los modelos actualizados correctamente");
        }
      } else {
        toast.success("Modelos de electricidad y agua actualizados");
        if (modeloEstado) {
          const faltan = modeloEstado.min_registros_requeridos - modeloEstado.n_transacciones_disponibles;
          toast.info(`Modelo de flota: faltan ${faltan} transacciones para adaptar`);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      await queryClient.invalidateQueries({ queryKey: ["analisis-flota"] });
      await refetchEstado();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo reentrenar el modelo");
    } finally {
      setTraining(false);
    }
  };

  if (isLoading) return <PrediccionesMLSkeleton />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Predicciones ML</h2>
            <p className="text-sm text-muted-foreground">Modelos de Machine Learning para pronóstico de consumo</p>
          </div>
          <Button onClick={retrainModel} disabled={training}>
            {training ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
            {training ? "Actualizando modelos…" : "Actualizar todos los modelos"}
          </Button>
        </div>

        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar predicciones.</Card>}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Brain className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-xs text-muted-foreground">Precisión Promedio E/A</p>
              <p className="text-2xl font-bold">{(data?.predictions.accuracy_pct ?? 0).toFixed(1)}%</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                E: {(data?.predictions.accuracy_breakdown_pct?.electricity ?? 0).toFixed(1)}% · A:{" "}
                {(data?.predictions.accuracy_breakdown_pct?.water ?? 0).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-xs text-muted-foreground">Ahorro Proyectado</p>
              <p className="text-2xl font-bold">${(data?.predictions.projected_savings_usd ?? 0).toLocaleString("es-CL")}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Mejora media futura: {(data?.predictions.annual_savings_summary?.avg_future_savings_pct ?? 0).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-xs text-muted-foreground">Anomalías Activas</p>
              <p className="text-2xl font-bold">{data?.predictions.anomaly_count ?? 0}</p>
              {anomaliasTotales > 0 && (
                <p className="text-[11px] text-orange-500 mt-1">+{anomaliasTotales} en flota combustible</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Modelos Campeones */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modelos Campeones</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Electricidad</p>
              <p className="font-semibold">{data?.predictions.champion_models?.electricity ?? "N/D"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Agua</p>
              <p className="font-semibold">{data?.predictions.champion_models?.water ?? "N/D"}</p>
            </div>
            <div className={`rounded-lg border p-3 ${modeloEstado?.trained_with_company_data ? "border-green-500/30 bg-green-500/5" : "border-orange-500/30 bg-orange-500/5"}`}>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Fuel className="h-3 w-3" /> Combustible / Flota (viajes individuales)
              </p>
              <p className="font-semibold text-sm">Random Forest + litros_teoricos</p>
              {modeloEstado?.trained_with_company_data ? (
                <>
                  <p className="text-[11px] text-green-700 mt-0.5 font-medium">
                    Adaptado a esta empresa · {modeloEstado.n_empresa} transacciones
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    err.rel {modeloEstado.error_relativo_empresa_pct?.toFixed(1)}% · última actualización {modeloEstado.retrained_at ? new Date(modeloEstado.retrained_at).toLocaleDateString("es-CL") : "sin registro"}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-orange-600 mt-0.5">Modelo genérico (dataset externo UK)</p>
                  <p className="text-[11px] text-muted-foreground">
                    {modeloEstado
                      ? modeloEstado.puede_reentrenar
                        ? `${modeloEstado.n_transacciones_disponibles} transacciones listas, se adaptará al actualizar`
                        : `Faltan ${modeloEstado.min_registros_requeridos - modeloEstado.n_transacciones_disponibles} transacciones para adaptar`
                      : "err.rel 6.13% sobre dataset de referencia"}
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPIs de flota combustible */}
        {flota && flota.total_registros_analizados > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Fuel className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  Precisión sobre datos reales de flota
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 cursor-help opacity-60" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px] text-xs">
                      Porcentaje promedio de exactitud del modelo al comparar la predicción con el consumo real registrado en cada viaje. 100% significa predicción perfecta.
                    </TooltipContent>
                  </Tooltip>
                </p>
                <p className="text-2xl font-bold">{flota.precision_promedio_pct.toFixed(1)}%</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {flota.total_registros_analizados} transacciones analizadas
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  Ahorro potencial de combustible
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 cursor-help opacity-60" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px] text-xs">
                      Litros consumidos en exceso por encima de lo que el modelo predice como eficiente. Representa lo que se podría ahorrar corrigiendo las ineficiencias detectadas.
                    </TooltipContent>
                  </Tooltip>
                </p>
                <p className="text-2xl font-bold">
                  {flota.ahorro_proyectado_litros.toLocaleString("es-CL", { maximumFractionDigits: 0 })} L
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  ${flota.ahorro_proyectado_clp.toLocaleString("es-CL")} CLP · {flota.reduccion_co2_proyectada_kg.toLocaleString("es-CL", { maximumFractionDigits: 0 })} kg CO₂
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TriangleAlert className={`h-8 w-8 mx-auto mb-2 ${anomaliasAltas > 0 ? "text-red-500" : "text-yellow-500"}`} />
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  Viajes con consumo anómalo
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 cursor-help opacity-60" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px] text-xs">
                      Número de viajes donde el combustible consumido supera en más del 10% lo que el modelo predice como normal para esa distancia y vehículo.
                    </TooltipContent>
                  </Tooltip>
                </p>
                <p className="text-2xl font-bold">{flota.registros_con_desvio}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {anomaliasAltas} críticas · desvío &gt;10%
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Anomalías de Flota - resumen con link a /anomalias */}
        {flota && flota.anomalias.length > 0 && (
          <Card className="border-orange-500/20">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <TriangleAlert className="h-5 w-5 text-orange-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">
                    {flota.anomalias.length} ineficiencias detectadas en flota
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {flota.anomalias.filter(a => a.severidad === "alta").length} alta ·{" "}
                    {flota.anomalias.filter(a => a.severidad === "media").length} media ·{" "}
                    {flota.anomalias.filter(a => a.severidad === "baja").length} baja ·{" "}
                    {flota.anomalias.reduce((s, a) => s + a.co2_exceso_kg, 0).toFixed(0)} kg CO₂ en exceso
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/anomalias">
                  Ver detalle <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recomendaciones (agua/electricidad) */}
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

            {/* Recomendaciones automáticas basadas en anomalías de flota */}
            {flota && flota.registros_con_desvio > 0 && (() => {
              const anomaliasTruck = flota.anomalias.filter(a => a.vehicle_cat === "Truck" && a.desvio_pct > 15);
              const pctTruck = flota.anomalias.length > 0
                ? (anomaliasTruck.length / flota.anomalias.length) * 100
                : 0;
              const excesoCo2Total = flota.anomalias.reduce((s, a) => s + a.co2_exceso_kg, 0);

              return (
                <>
                  {pctTruck > 20 && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm">
                          Revisar estado mecánico de flota pesada: el {pctTruck.toFixed(0)}% de los camiones
                          tiene consumo que supera en más del 15% la predicción del modelo.
                        </p>
                      </div>
                      <Badge variant="destructive">Alta</Badge>
                    </div>
                  )}
                  {excesoCo2Total > 100 && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                      <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm">
                          Exceso de emisiones Scope 1 detectado ({excesoCo2Total.toFixed(0)} kg CO₂).
                          Se recomienda revisar el plan de mantenimiento preventivo antes del próximo reporte RETC.
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800">Media</Badge>
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
