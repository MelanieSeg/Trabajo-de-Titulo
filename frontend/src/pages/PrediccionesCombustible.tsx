import { useState } from "react";
import {
  Brain, Fuel, Loader2, AlertTriangle, CheckCircle,
  Info, TrendingDown, DollarSign, Leaf, TriangleAlert,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { predictFuelConsumption, type FuelPredictionRequest, type FuelPredictionResponse } from "@/lib/api";

const VEHICLE_LABELS: Record<FuelPredictionRequest["vehicle_cat"], string> = {
  Van:   "Van / Furgoneta",
  Truck: "Camión / HGV",
  Bus:   "Bus / Minibús",
  Car:   "Automóvil",
};

const FUEL_LABELS: Record<FuelPredictionRequest["fuel_type"], string> = {
  D: "Diésel",
  G: "Gas Oil",
};

const CO2_FACTOR: Record<FuelPredictionRequest["fuel_type"], number> = {
  D: 2.68,
  G: 1.89,
};

const PRECIO_DEFAULT: Record<FuelPredictionRequest["fuel_type"] | "", number> = {
  D: 1050, G: 950, "": 1050,
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
  }>({ vehicle_cat: "", fuel_type: "", dist_km: "", km_per_liter: "", precio_litro_clp: "1050" });

  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState<FuelPredictionResponse | null>(null);
  const [litrosReales, setLitrosReales] = useState("");

  const isFormValid =
    form.vehicle_cat !== "" &&
    form.fuel_type   !== "" &&
    parseFloat(form.dist_km)          > 0 &&
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al calcular la predicción");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm({ vehicle_cat: "", fuel_type: "", dist_km: "", km_per_liter: "", precio_litro_clp: "1050" });
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

        <div>
          <h2 className="text-xl font-bold text-foreground">Predicción de Consumo de Combustible</h2>
          <p className="text-sm text-muted-foreground">
            Modelo supervisado · análisis de costos · detección de ineficiencias — CRISP-DM Sprint 3
          </p>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Random Forest · error relativo 6.13% </span>
              — Entrenado con 5.795 registros de flota municipal (Leeds 2013–2019),
              validación TimeSeriesSplit. Feature engineering: <em>litros_teoricos = dist_km / km_per_liter</em>.
              Umbral de aceptación ≤ 10% ✓
            </p>
          </CardContent>
        </Card>

        {/* ── SECCIÓN 1: Formulario ── */}
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
                        {FUEL_LABELS[ft]} — {CO2_FACTOR[ft]} kg CO₂/L
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Distancia total del período (km)</Label>
                <Input
                  type="number" min={1} step={1} placeholder="Ej: 1.200"
                  value={form.dist_km}
                  onChange={(e) => setForm((f) => ({ ...f, dist_km: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Kilómetros acumulados del vehículo en el período (semana, mes).
                  No por viaje individual — el modelo fue entrenado con consumos agregados por período.
                </p>
              </div>

              <div className="space-y-2">
                <Label>
                  Eficiencia histórica (km/L)
                  <Badge variant="outline" className="ml-2 text-[10px] font-normal">Opcional</Badge>
                </Label>
                <Input
                  type="number" min={0.1} step={0.1} placeholder="Ej: 8.5 — déjalo vacío para usar promedio de flota"
                  value={form.km_per_liter}
                  onChange={(e) => setForm((f) => ({ ...f, km_per_liter: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Si no se ingresa, el modelo usa la eficiencia promedio del dataset de entrenamiento
                  para el tipo de vehículo seleccionado (imputación por mediana).
                  Referencia: Van ≈ 10–14 · Camión ≈ 4–8 · Bus ≈ 5–9 km/L.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Precio por litro (CLP)</Label>
                <Input
                  type="number" min={1} step={10} placeholder="Ej: 1050"
                  value={form.precio_litro_clp}
                  onChange={(e) => setForm((f) => ({ ...f, precio_litro_clp: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Referencia: Diésel ≈ $1.050/L · Gas Oil ≈ $950/L (Chile, 2026)
                </p>
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

        {/* ── SECCIÓN 2: Escenario de optimización ── */}
        {result && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-green-600" />
                Escenario de optimización — +{result.optimizacion.mejora_eficiencia_pct}% de eficiencia
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

        {/* ── SECCIÓN 3: Verificación real vs predicho ── */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-yellow-500" />
                Verificación post-operación — real vs predicho
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
                          Alerta de ineficiencia operacional — desvío +{desv.toFixed(1)}%
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
                          Operación dentro del rango aceptable — desvío {desv >= 0 ? "+" : ""}{desv.toFixed(1)}%
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

      </div>
    </DashboardLayout>
  );
}
