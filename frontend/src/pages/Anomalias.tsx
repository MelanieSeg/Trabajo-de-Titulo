import { AlertTriangle, CheckCircle, Clock, Fuel, XCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";
import { resolveAlert, getAnalisisFlota, type AnalisisFlotaResult } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const severityConfig: Record<string, { icon: typeof AlertTriangle; color: string; badge: string }> = {
  critical: { icon: XCircle,        color: "text-red-500",    badge: "bg-red-100 text-red-800" },
  warning:  { icon: AlertTriangle,  color: "text-yellow-500", badge: "bg-yellow-100 text-yellow-800" },
  info:     { icon: CheckCircle,    color: "text-blue-500",   badge: "bg-blue-100 text-blue-800" },
};

const severidadFlotaConfig = {
  alta:  { color: "text-red-500",    badge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  media: { color: "text-yellow-500", badge: "bg-yellow-100 text-yellow-800" },
  baja:  { color: "text-blue-500",   badge: "bg-blue-100 text-blue-800" },
};

export default function Anomalias() {
  const { data, isLoading, isError } = useOperationsOverview();
  const queryClient = useQueryClient();

  const { data: flota } = useQuery<AnalisisFlotaResult>({
    queryKey: ["analisis-flota"],
    queryFn: getAnalisisFlota,
    staleTime: 1000 * 60 * 5,
  });

  const anomalies = data?.anomalies.items ?? [];
  const anomaliasFlota = flota?.anomalias ?? [];

  const handleResolve = async (id: number) => {
    try {
      await resolveAlert(id);
      await queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      toast.success("Anomalía marcada como resuelta");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo resolver la anomalía");
    }
  };

  const flotaAltas   = anomaliasFlota.filter(a => a.severidad === "alta").length;
  const flotaMedias  = anomaliasFlota.filter(a => a.severidad === "media").length;
  const flotaBajas   = anomaliasFlota.filter(a => a.severidad === "baja").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Detección de Anomalías</h2>
          <p className="text-sm text-muted-foreground">Alertas automáticas por patrones inusuales de consumo</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando anomalías...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar anomalías.</Card>}

        {/* ── KPIs agua/electricidad ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
              <p className="text-2xl font-bold">{data?.anomalies.critical ?? 0}</p>
              <p className="text-xs text-muted-foreground">Críticas (E/A)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold">{data?.anomalies.warning ?? 0}</p>
              <p className="text-xs text-muted-foreground">Advertencias (E/A)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{data?.anomalies.resolved ?? 0}</p>
              <p className="text-xs text-muted-foreground">Resueltas</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Lista anomalías agua/electricidad ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anomalías Detectadas — Energía y Agua</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {anomalies.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin anomalías activas en agua/electricidad.</p>
            )}
            {anomalies.map((anomaly) => {
              const cfg = severityConfig[anomaly.severity] ?? severityConfig.info;
              return (
                <div key={anomaly.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <cfg.icon className={`h-5 w-5 shrink-0 mt-0.5 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{anomaly.type}</p>
                    <p className="text-xs text-muted-foreground">{anomaly.area} — {anomaly.date}</p>
                    <p className="text-xs font-mono mt-1">{anomaly.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{anomaly.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary" className={cfg.badge}>
                      {anomaly.severity === "critical" ? "Crítico" : anomaly.severity === "warning" ? "Alerta" : "Info"}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />{anomaly.status}
                    </span>
                    {anomaly.status !== "Resuelta" && (
                      <Button size="sm" variant="outline" onClick={() => handleResolve(anomaly.id)}>
                        Resolver
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ── KPIs flota combustible ── */}
        {anomaliasFlota.length > 0 && (
          <>
            <div className="flex items-center gap-2 pt-2">
              <Fuel className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold text-foreground">Anomalías Detectadas por IA — Flota de Combustible</h3>
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 ml-auto">
                Modelo Random Forest · err.rel 6.13%
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-red-500/30">
                <CardContent className="p-4 text-center">
                  <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                  <p className="text-2xl font-bold">{flotaAltas}</p>
                  <p className="text-xs text-muted-foreground">Severidad Alta (&gt;35% desvío)</p>
                </CardContent>
              </Card>
              <Card className="border-yellow-500/30">
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  <p className="text-2xl font-bold">{flotaMedias}</p>
                  <p className="text-xs text-muted-foreground">Severidad Media (20–35%)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold">{flotaBajas}</p>
                  <p className="text-xs text-muted-foreground">Severidad Baja (10–20%)</p>
                </CardContent>
              </Card>
            </div>

            {/* ── Tabla de anomalías de flota ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Fuel className="h-4 w-4 text-orange-500" />
                  Detalle de Ineficiencias de Flota
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    — desvío sobre predicción del modelo IA
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-muted-foreground text-xs">
                        <th className="p-3 text-left">Vehículo</th>
                        <th className="p-3 text-left">Fecha</th>
                        <th className="p-3 text-right">Real (L)</th>
                        <th className="p-3 text-right">Predicho (L)</th>
                        <th className="p-3 text-right">Desvío</th>
                        <th className="p-3 text-center">Severidad</th>
                        <th className="p-3 text-right">CO₂ exceso (kg)</th>
                        <th className="p-3 text-right">Costo exceso (CLP)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anomaliasFlota.map((a) => {
                        const cfg = severidadFlotaConfig[a.severidad];
                        return (
                          <tr key={a.id_transaccion} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="p-3">
                              <span className="font-mono text-xs font-medium">{a.vehicle_id}</span>
                              <span className="ml-1 text-xs text-muted-foreground">({a.vehicle_cat})</span>
                            </td>
                            <td className="p-3 text-muted-foreground text-xs">{a.fecha}</td>
                            <td className="p-3 text-right font-medium">{a.fuel_liters_real.toFixed(1)}</td>
                            <td className="p-3 text-right text-muted-foreground">{a.fuel_liters_predicho.toFixed(1)}</td>
                            <td className={`p-3 text-right font-bold ${cfg.color}`}>+{a.desvio_pct.toFixed(1)}%</td>
                            <td className="p-3 text-center">
                              <Badge variant="secondary" className={cfg.badge}>
                                {a.severidad === "alta" ? "Alta" : a.severidad === "media" ? "Media" : "Baja"}
                              </Badge>
                            </td>
                            <td className="p-3 text-right text-orange-600">{a.co2_exceso_kg.toFixed(1)}</td>
                            <td className="p-3 text-right text-muted-foreground">
                              ${a.costo_exceso_clp.toLocaleString("es-CL")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/20 font-semibold text-xs">
                        <td className="p-3" colSpan={6}>Total exceso detectado</td>
                        <td className="p-3 text-right text-orange-600">
                          {anomaliasFlota.reduce((s, a) => s + a.co2_exceso_kg, 0).toFixed(1)} kg
                        </td>
                        <td className="p-3 text-right">
                          ${anomaliasFlota.reduce((s, a) => s + a.costo_exceso_clp, 0).toLocaleString("es-CL")}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
