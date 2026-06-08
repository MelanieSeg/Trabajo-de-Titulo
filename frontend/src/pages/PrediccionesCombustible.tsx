import { useState, useEffect, useCallback } from "react";
import {
  Brain, Fuel, Loader2, AlertTriangle, CheckCircle,
  Info, TrendingDown, DollarSign, Leaf, TriangleAlert, History,
  RefreshCw, ShieldCheck, Globe,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  predictFuelConsumption, getFuelHistorial, getModeloEstado,
  type FuelPredictionRequest, type FuelPredictionResponse, type FuelPredictionLogItem,
  type ModeloEstado,
} from "@/lib/api";
import { Link } from "react-router-dom";
import { ModeloEstadoSkeleton } from "@/components/skeletons/PageSkeleton";

const VEHICLE_LABELS: Record<FuelPredictionRequest["vehicle_cat"], string> = {
  Van:   "Furgoneta",
  Truck: "Camión",
  Bus:   "Bus",
  Car:   "Auto",
};

const FUEL_LABELS: Record<FuelPredictionRequest["fuel_type"], string> = {
  D: "Diésel",
  G: "Gas Oil",
};

// Factor diésel: 2,74 kg CO₂e/L (Guía HuellaChile, MMA 2023). Gas oil: 1,89 (IPCC 2006 Tier 1).
const CO2_FACTOR: Record<FuelPredictionRequest["fuel_type"], number> = {
  D: 2.74,
  G: 1.89,
};

const PRECIO_DEFAULT: Record<FuelPredictionRequest["fuel_type"] | "", number> = {
  D: 1549, G: 1549, "": 1549,
};

function clp(value: number) {
  return `$${Math.round(value).toLocaleString("es-CL")}`;
}

function desviacion(real: number, predicho: number) {
  return ((real - predicho) / predicho) * 100;
}

function KpiCard({ label, value, unit, icon, highlight }: {
  label: string; value: string; unit: string;
  icon: React.ReactNode; highlight?: "green" | "yellow" | "red";
}) {
  const colors = {
    green:  "border-green-500/40 bg-green-500/5",
    yellow: "border-yellow-500/40 bg-yellow-500/5",
    red:    "border-red-500/40 bg-red-500/5",
  };
  return (
    <Card className={highlight ? colors[highlight] : ""}>
      <CardContent className="p-4 flex flex-col items-center text-center gap-1">
        <div className="text-primary mb-1">{icon}</div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{unit}</p>
      </CardContent>
    </Card>
  );
}

type VehicleCat = FuelPredictionRequest["vehicle_cat"] | "";
type FuelType   = FuelPredictionRequest["fuel_type"]   | "";

export default function PrediccionesCombustible() {
  const [form, setForm] = useState<{
    vehicle_cat:      VehicleCat;
    fuel_type:        FuelType;
    dist_km:          string;
    km_per_liter:     string;
    precio_litro_clp: string;
  }>({ vehicle_cat: "", fuel_type: "", dist_km: "", km_per_liter: "", precio_litro_clp: "1549" });

  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState<FuelPredictionResponse | null>(null);
  const [litrosReales, setLitrosReales] = useState("");
  const [historial,    setHistorial]    = useState<FuelPredictionLogItem[]>([]);
  const [pagHist,      setPagHist]      = useState(1);

  const { data: modeloEstado, isLoading: isLoadingModelo } = useQuery<ModeloEstado>({
    queryKey: ["combustible-modelo-estado"],
    queryFn: getModeloEstado,
    staleTime: 1000 * 60 * 5,
  });

  const HIST_PAGE_SIZE = 10;

  const cargarHistorial = useCallback(() => {
    getFuelHistorial(50).then((data) => { setHistorial(data); setPagHist(1); }).catch(() => {});
  }, []);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const distKmNum = parseFloat(form.dist_km);

  const isFormValid =
    form.vehicle_cat !== "" &&
    form.fuel_type   !== "" &&
    distKmNum > 0 &&
    parseFloat(form.precio_litro_clp) > 0;

  function handleFuelTypeChange(v: FuelType) {
    setForm((f) => ({ ...f, fuel_type: v, precio_litro_clp: String(PRECIO_DEFAULT[v]) }));
  }

  async function handlePredict() {
    if (!isFormValid) return;
    setLoading(true);
    setResult(null);
    setLitrosReales("");
    try {
      const kmPerLiter = form.km_per_liter.trim() !== "" ? parseFloat(form.km_per_liter) : null;
      const data = await predictFuelConsumption({
        vehicle_cat:      form.vehicle_cat as FuelPredictionRequest["vehicle_cat"],
        fuel_type:        form.fuel_type   as FuelPredictionRequest["fuel_type"],
        dist_km:          parseFloat(form.dist_km),
        km_per_liter:     kmPerLiter,
        precio_litro_clp: parseFloat(form.precio_litro_clp),
      });
      setResult(data);
      cargarHistorial();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al calcular la predicción");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm({ vehicle_cat: "", fuel_type: "", dist_km: "", km_per_liter: "", precio_litro_clp: "1549" });
    setResult(null);
    setLitrosReales("");
  }

  const litrosRealesNum = parseFloat(litrosReales);
  const hayComparacion  = result !== null && litrosRealesNum > 0;
  const desv            = hayComparacion ? desviacion(litrosRealesNum, result!.fuel_liters) : 0;
  const esIneficiente   = hayComparacion && desv > 10;
  const costoReal       = hayComparacion ? litrosRealesNum * result!.precio_litro_clp : 0;
  const excesoCosto     = hayComparacion ? costoReal - result!.costo_clp : 0;
  const fuelKey         = result?.fuel_type_label === "Diésel" ? "D" : "G";
  const excesoCo2       = hayComparacion
    ? (litrosRealesNum - result!.fuel_liters) * CO2_FACTOR[fuelKey]
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-foreground">Predicción de Consumo de Combustible</h2>
            <p className="text-sm text-muted-foreground">
              Modelo supervisado de predicción de consumo de combustible para gestión de flota
            </p>
          </div>
        </div>

        {/* Estado del modelo */}
        {isLoadingModelo ? <ModeloEstadoSkeleton /> : modeloEstado && (
          <Card className={modeloEstado.trained_with_company_data
            ? "border-green-500/30 bg-green-500/5"
            : "border-orange-500/30 bg-orange-500/5"
          }>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  {modeloEstado.trained_with_company_data
                    ? <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
                    : <Globe className="h-5 w-5 text-orange-500 shrink-0" />
                  }
                  <div>
                    <p className="text-sm font-semibold">
                      {modeloEstado.trained_with_company_data
                        ? "Modelo adaptado a esta empresa"
                        : "Modelo genérico de referencia (dataset externo)"
                      }
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {modeloEstado.trained_with_company_data
                        ? `Entrenado con ${modeloEstado.n_empresa} transacciones propias + ${modeloEstado.n_base?.toLocaleString("es-CL")} base · err.rel ${modeloEstado.error_relativo_empresa_pct?.toFixed(1)}% sobre datos de flota`
                        : `Random Forest entrenado con 5.795 registros externos · ${modeloEstado.n_transacciones_disponibles} transacciones disponibles para adaptar`
                      }
                    </p>
                    {modeloEstado.retrained_at && (
                      <p className="text-xs text-muted-foreground">
                        Última adaptación: {new Date(modeloEstado.retrained_at).toLocaleString("es-CL")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!modeloEstado.trained_with_company_data && modeloEstado.puede_reentrenar && (
                    <span className="text-xs text-green-700 font-medium">
                      {modeloEstado.n_transacciones_disponibles} transacciones listas
                    </span>
                  )}
                  {!modeloEstado.puede_reentrenar && (
                    <span className="text-xs text-muted-foreground">
                      Faltan {modeloEstado.min_registros_requeridos - modeloEstado.n_transacciones_disponibles} transacciones
                    </span>
                  )}
                  <Link to="/predicciones">
                    <Button size="sm" variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Actualizar en Predicciones ML
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Random Forest · error relativo 6.13%.</span>
              {" "}Entrenado con 5.795 registros de flota municipal (Leeds 2013–2019),
              validación TimeSeriesSplit. Feature engineering: <em>litros_teoricos = dist_km / km_per_liter</em>.
              Umbral de aceptación ≤ 10% ✓
            </p>
          </CardContent>
        </Card>

        {/* SECCIÓN 1: Formulario */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Fuel className="h-4 w-4 text-primary" />
                Parámetros de la operación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="space-y-2">
                <Label>Categoría del vehículo</Label>
                <Select
                  value={form.vehicle_cat}
                  onValueChange={(v) => setForm((f) => ({ ...f, vehicle_cat: v as VehicleCat }))}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(VEHICLE_LABELS) as FuelPredictionRequest["vehicle_cat"][]).map((cat) => (
                      <SelectItem key={cat} value={cat}>{VEHICLE_LABELS[cat]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de combustible</Label>
                <Select value={form.fuel_type} onValueChange={handleFuelTypeChange}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FUEL_LABELS) as FuelPredictionRequest["fuel_type"][]).map((ft) => (
                      <SelectItem key={ft} value={ft}>
                        {FUEL_LABELS[ft]} ({CO2_FACTOR[ft]} kg CO₂/L)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Distancia total del período (km)</Label>
                <Input
                  type="number" min={1} step={1} placeholder="Ej: 500"
                  value={form.dist_km}
                  onChange={(e) => setForm((f) => ({ ...f, dist_km: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Kilómetros acumulados del vehículo en el período (semana, mes).
                  El modelo mejora su precisión para tu flota al reentrenarlo con datos reales propios.
                </p>
              </div>

              <div className="space-y-2">
                <Label>
                  Eficiencia histórica (km/L)
                  <Badge variant="outline" className="ml-2 text-[10px] font-normal">Opcional</Badge>
                </Label>
                <Input
                  type="number" min={0.1} step={0.1} placeholder="Ej: 8.5 (vacío: usa promedio de flota)"
                  value={form.km_per_liter}
                  onChange={(e) => setForm((f) => ({ ...f, km_per_liter: e.target.value }))}
                />
                {/* Aviso cuando la distancia es baja y km/L no está informado */}
                {form.km_per_liter.trim() === "" && parseFloat(form.dist_km) > 0 && parseFloat(form.dist_km) < 200 ? (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-start gap-1 font-medium">
                    <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Para distancias cortas (&lt;200 km) el modelo puede producir resultados imprecisos
                    sin km/L informado. Ingresa la eficiencia real del vehículo para mayor exactitud.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Si no se ingresa, el modelo usa la eficiencia promedio del dataset de entrenamiento
                    para el tipo de vehículo seleccionado (imputación por mediana).
                    Referencia: Van ≈ 10–14 · Camión ≈ 4–8 · Bus ≈ 5–9 km/L.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Precio por litro (CLP)</Label>
                <Input
                  type="number" min={1} step={10} placeholder="Ej: 1549"
                  value={form.precio_litro_clp}
                  onChange={(e) => setForm((f) => ({ ...f, precio_litro_clp: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button onClick={handlePredict} disabled={!isFormValid || loading} className="flex-1">
                  {loading
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Calculando...</>
                    : <><Brain className="h-4 w-4 mr-2" />Predecir consumo</>}
                </Button>
                {result && <Button variant="outline" onClick={handleReset}>Limpiar</Button>}
              </div>
            </CardContent>
          </Card>

          {/* Panel de resultados */}
          <div className="space-y-4">
            {!result && !loading && (
              <Card className="h-full flex items-center justify-center min-h-[300px]">
                <CardContent className="text-center text-muted-foreground p-8">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Completa los parámetros y presiona "Predecir consumo"</p>
                </CardContent>
              </Card>
            )}

            {result && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-600">Predicción generada</span>
                  {result.km_per_liter_fue_imputado && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Eficiencia imputada: {result.km_per_liter_usado} km/L (mediana de flota)
                    </Badge>
                  )}
                  <Badge variant="secondary" className="ml-auto text-xs">{result.model_name}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <KpiCard
                    label="Consumo estimado"
                    value={result.fuel_liters.toLocaleString("es-CL", { maximumFractionDigits: 1 })}
                    unit="litros"
                    icon={<Fuel className="h-5 w-5" />}
                  />
                  <KpiCard
                    label="Costo estimado"
                    value={clp(result.costo_clp)}
                    unit={`${clp(result.costo_por_km_clp)} / km`}
                    icon={<DollarSign className="h-5 w-5 text-green-600" />}
                    highlight="green"
                  />
                  <KpiCard
                    label="Emisiones CO₂"
                    value={result.co2_kg.toLocaleString("es-CL", { maximumFractionDigits: 1 })}
                    unit="kg CO₂e Scope 1"
                    icon={<Leaf className="h-5 w-5 text-yellow-600" />}
                    highlight="yellow"
                  />
                  <KpiCard
                    label="Emisiones CO₂"
                    value={result.co2_toneladas.toLocaleString("es-CL", { maximumFractionDigits: 4 })}
                    unit="toneladas CO₂e"
                    icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* SECCIÓN 2: Escenario de optimización */}
        {result && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-green-600" />
                Escenario de optimización: +{result.optimizacion.mejora_eficiencia_pct}% de eficiencia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Si la eficiencia mejorara de{" "}
                <span className="font-medium text-foreground">
                  {result.optimizacion.km_per_liter_efectivo} km/L
                </span>{" "}a{" "}
                <span className="font-medium text-green-600">
                  {result.optimizacion.km_per_liter_mejorado} km/L
                </span>{" "}
                mediante mantenimiento preventivo o ajuste de conducción, el ahorro proyectado sería:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg bg-background border p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Ahorro en litros</p>
                  <p className="text-2xl font-bold text-green-600">
                    {result.optimizacion.ahorro_litros.toLocaleString("es-CL", { maximumFractionDigits: 1 })} L
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {result.optimizacion.fuel_liters_mejorado.toLocaleString("es-CL", { maximumFractionDigits: 1 })} L estimados
                  </p>
                </div>
                <div className="rounded-lg bg-background border p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Ahorro en costo</p>
                  <p className="text-2xl font-bold text-green-600">{clp(result.optimizacion.ahorro_clp)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    optimizado: {clp(result.optimizacion.costo_clp_mejorado)}
                  </p>
                </div>
                <div className="rounded-lg bg-background border p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Reducción CO₂</p>
                  <p className="text-2xl font-bold text-green-600">
                    {result.optimizacion.ahorro_co2_kg.toLocaleString("es-CL", { maximumFractionDigits: 1 })} kg
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    optimizado: {result.optimizacion.co2_kg_mejorado.toLocaleString("es-CL", { maximumFractionDigits: 1 })} kg
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECCIÓN 3: Verificación real vs predicho */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-yellow-500" />
                Verificación post-operación: real vs predicho
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Una vez completada la operación, ingresa los litros reales consumidos para detectar
                ineficiencias. Si el consumo real supera en más de un 10% la predicción, el sistema
                genera una alerta de desvío operacional.
              </p>

              <div className="flex gap-3 items-end">
                <div className="space-y-2 flex-1 max-w-xs">
                  <Label>Litros reales consumidos</Label>
                  <Input
                    type="number" min={0.1} step={0.1} placeholder="Ej: 43.2"
                    value={litrosReales}
                    onChange={(e) => setLitrosReales(e.target.value)}
                  />
                </div>
                {hayComparacion && (
                  <Button variant="outline" onClick={() => setLitrosReales("")}>Limpiar</Button>
                )}
              </div>

              {hayComparacion && (
                <div className="space-y-4">
                  {esIneficiente ? (
                    <div className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/5 p-4">
                      <TriangleAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-600">
                          Alerta de ineficiencia operacional: desvío +{desv.toFixed(1)}%
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          El consumo real superó la predicción del modelo en más del 10%. Se recomienda
                          revisar el estado mecánico del vehículo, la ruta utilizada y el estilo de conducción.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 rounded-lg border border-green-500/40 bg-green-500/5 p-4">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-green-600">
                          Operación dentro del rango aceptable (desvío {desv >= 0 ? "+" : ""}{desv.toFixed(1)}%)
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          El consumo real está dentro del umbral de ±10% definido por el modelo. No se detectan anomalías.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium text-muted-foreground">Métrica</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Predicho</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Real</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        <tr>
                          <td className="p-3 text-muted-foreground">Litros consumidos</td>
                          <td className="p-3 text-right font-medium">
                            {result.fuel_liters.toLocaleString("es-CL", { maximumFractionDigits: 1 })} L
                          </td>
                          <td className="p-3 text-right font-medium">
                            {litrosRealesNum.toLocaleString("es-CL", { maximumFractionDigits: 1 })} L
                          </td>
                          <td className={`p-3 text-right font-semibold ${esIneficiente ? "text-red-500" : "text-green-600"}`}>
                            {desv >= 0 ? "+" : ""}{desv.toFixed(1)}%
                          </td>
                        </tr>
                        <tr>
                          <td className="p-3 text-muted-foreground">Costo operación</td>
                          <td className="p-3 text-right font-medium">{clp(result.costo_clp)}</td>
                          <td className="p-3 text-right font-medium">{clp(costoReal)}</td>
                          <td className={`p-3 text-right font-semibold ${excesoCosto > 0 ? "text-red-500" : "text-green-600"}`}>
                            {excesoCosto >= 0 ? "+" : ""}{clp(excesoCosto)}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-3 text-muted-foreground">Emisiones CO₂</td>
                          <td className="p-3 text-right font-medium">
                            {result.co2_kg.toLocaleString("es-CL", { maximumFractionDigits: 1 })} kg
                          </td>
                          <td className="p-3 text-right font-medium">
                            {(litrosRealesNum * CO2_FACTOR[fuelKey]).toLocaleString("es-CL", { maximumFractionDigits: 1 })} kg
                          </td>
                          <td className={`p-3 text-right font-semibold ${excesoCo2 > 0 ? "text-red-500" : "text-green-600"}`}>
                            {excesoCo2 >= 0 ? "+" : ""}{excesoCo2.toLocaleString("es-CL", { maximumFractionDigits: 1 })} kg
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Historial de predicciones */}
        {historial.length > 0 && (() => {
          const totalPagesHist = Math.ceil(historial.length / HIST_PAGE_SIZE);
          const historialPaginado = historial.slice(
            (pagHist - 1) * HIST_PAGE_SIZE,
            pagHist * HIST_PAGE_SIZE,
          );
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Historial de predicciones recientes
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {historial.length} registros
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-muted-foreground text-xs">
                        <th className="p-3 text-left">Fecha</th>
                        <th className="p-3 text-left">Vehículo</th>
                        <th className="p-3 text-left">Combustible</th>
                        <th className="p-3 text-right">Distancia (km)</th>
                        <th className="p-3 text-right">Litros pred.</th>
                        <th className="p-3 text-right">CO₂ (kg)</th>
                        <th className="p-3 text-right">Costo CLP</th>
                        <th className="p-3 text-right">Ahorro posible (L)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialPaginado.map((item) => (
                        <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {new Date(item.created_at).toLocaleString("es-CL", {
                              day: "2-digit", month: "2-digit", year: "2-digit",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </td>
                          <td className="p-3">{VEHICLE_LABELS[item.vehicle_cat as keyof typeof VEHICLE_LABELS] ?? item.vehicle_cat}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">
                              {item.fuel_type === "D" ? "Diésel" : "Gas Oil"}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-medium">
                            {item.dist_km.toLocaleString("es-CL")}
                          </td>
                          <td className="p-3 text-right font-medium">
                            {item.fuel_liters.toLocaleString("es-CL", { maximumFractionDigits: 1 })} L
                          </td>
                          <td className="p-3 text-right">
                            {item.co2_kg.toLocaleString("es-CL", { maximumFractionDigits: 1 })}
                          </td>
                          <td className="p-3 text-right">
                            {clp(item.costo_clp)}
                          </td>
                          <td className="p-3 text-right text-green-600 font-medium">
                            {item.ahorro_litros > 0
                              ? `${item.ahorro_litros.toLocaleString("es-CL", { maximumFractionDigits: 1 })} L`
                              : "0 L"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Controles de paginación */}
                {totalPagesHist > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
                    <span>
                      Página {pagHist} de {totalPagesHist} · mostrando {historialPaginado.length} de {historial.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded px-2.5 py-1 border hover:bg-muted disabled:opacity-40 transition-colors"
                        disabled={pagHist === 1}
                        onClick={() => setPagHist((p) => p - 1)}
                      >
                        ← Anterior
                      </button>
                      {Array.from({ length: totalPagesHist }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          type="button"
                          className={`rounded px-2.5 py-1 border transition-colors ${
                            p === pagHist
                              ? "bg-primary text-primary-foreground border-primary"
                              : "hover:bg-muted"
                          }`}
                          onClick={() => setPagHist(p)}
                        >
                          {p}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="rounded px-2.5 py-1 border hover:bg-muted disabled:opacity-40 transition-colors"
                        disabled={pagHist === totalPagesHist}
                        onClick={() => setPagHist((p) => p + 1)}
                      >
                        Siguiente →
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

      </div>
    </DashboardLayout>
  );
}
