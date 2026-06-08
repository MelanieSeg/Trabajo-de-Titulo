import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertTriangle,
  Download,
  Droplets,
  Factory,
  FlaskConical,
  Fuel,
  Gauge,
  Leaf,
  Loader2,
  TrendingDown,
  TrendingUp,
  Wind,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { DashboardLayout } from "@/components/DashboardLayout";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useResourceOverview } from "@/hooks/useResourceOverview";
import { RecursoSkeleton } from "@/components/skeletons/PageSkeleton";
import { downloadResourceReport, type FuelBreakdownPoint, UtilityReportPeriodType } from "@/lib/api";
import { toast } from "sonner";

const SCOPE1_LABELS: Record<string, string> = {
  diesel:       "Diésel / Gas Oil (flota)",
  gasolina:     "Gasolina",
  gas_natural:  "Gas Natural",
  glp_propano:  "GLP / Propano",
  vapor_termica:"Vapor / Energía Térmica",
};

// estilos de gráficos
const axisStroke = "hsl(var(--muted-foreground))";
const gridStroke  = "hsl(var(--border))";
const tickStyle   = { fill: "hsl(var(--foreground))", fontSize: 12 };

const VEHICLE_CAT_ES: Record<string, string> = {
  Van: "Furgoneta", Truck: "Camión", Bus: "Bus", Car: "Auto",
};

const DIESEL_CHART_CONFIG = {
  consumo_D: { label: "Diésel (L)",         color: "hsl(24 82% 50%)"   },
  consumo_G: { label: "Gas Oil (L)",         color: "hsl(185 75% 45%)"  },
  costo_D:   { label: "Costo Diésel (USD)",  color: "hsl(24 82% 50%)"   },
  costo_G:   { label: "Costo Gas Oil (USD)", color: "hsl(185 75% 45%)"  },
};

// catálogo de recursos
const RESOURCE_UI: Record<
  string,
  { title: string; subtitle: string; icon: typeof Fuel; colorClass: string }
> = {
  gas_natural: {
    title: "Consumo de Gas Natural",
    subtitle: "Datos estimados según patrón de consumo de la instalación",
    icon: Fuel,
    colorClass: "text-emerald-600",
  },
  diesel: {
    title: "Consumo de Combustibles",
    subtitle: "Incluye diésel y gas oil para transporte y procesos",
    icon: Factory,
    colorClass: "text-amber-600",
  },
  gasolina: {
    title: "Consumo de Gasolina",
    subtitle: "Datos estimados según patrón de consumo de la instalación",
    icon: Gauge,
    colorClass: "text-orange-600",
  },
  glp_propano: {
    title: "GLP / Propano",
    subtitle: "Combustible gaseoso regulado por SEC",
    icon: Wind,
    colorClass: "text-cyan-600",
  },
  vapor_termica: {
    title: "Vapor / Energía Térmica",
    subtitle: "Energía térmica para procesos industriales",
    icon: Factory,
    colorClass: "text-red-600",
  },
  energia_renovable: {
    title: "Energía Renovable Generada",
    subtitle: "Generación solar/eólica/mini-hidro",
    icon: Leaf,
    colorClass: "text-green-600",
  },
  residuos: {
    title: "Residuos",
    subtitle: "Residuos sólidos, reciclables y peligrosos",
    icon: Droplets,
    colorClass: "text-slate-600",
  },
  emisiones_co2e: {
    title: "Emisiones Reales de CO2e",
    subtitle: "Reporte de huella real para cumplimiento GRI/CDP",
    icon: AlertTriangle,
    colorClass: "text-rose-600",
  },
  quimicos_consumibles: {
    title: "Químicos y Consumibles",
    subtitle: "Sustancias peligrosas y consumibles regulados",
    icon: FlaskConical,
    colorClass: "text-violet-600",
  },
};

const RESOURCE_COLORS: Record<
  string,
  { consumo: string; prediccion: string; costo: string }
> = {
  gas_natural:       { consumo: "hsl(140 60% 45%)", prediccion: "hsl(140 50% 35%)", costo: "hsl(42 90% 52%)" },
  diesel:            { consumo: "hsl(24 82% 50%)",  prediccion: "hsl(24 72% 40%)",  costo: "hsl(42 90% 52%)" },
  gasolina:          { consumo: "hsl(12 78% 52%)",  prediccion: "hsl(12 68% 42%)",  costo: "hsl(42 90% 52%)" },
  glp_propano:       { consumo: "hsl(185 75% 45%)", prediccion: "hsl(185 65% 35%)", costo: "hsl(42 90% 52%)" },
  vapor_termica:     { consumo: "hsl(8 70% 52%)",   prediccion: "hsl(8 60% 42%)",   costo: "hsl(42 90% 52%)" },
  energia_renovable: { consumo: "hsl(122 58% 44%)", prediccion: "hsl(122 50% 34%)", costo: "hsl(42 90% 52%)" },
  residuos:          { consumo: "hsl(210 12% 48%)", prediccion: "hsl(210 12% 36%)", costo: "hsl(42 90% 52%)" },
  emisiones_co2e:    { consumo: "hsl(340 78% 52%)", prediccion: "hsl(340 68% 42%)", costo: "hsl(42 90% 52%)" },
  quimicos_consumibles: { consumo: "hsl(275 62% 52%)", prediccion: "hsl(275 52% 42%)", costo: "hsl(42 90% 52%)" },
};

function severityVariant(severity: string): "destructive" | "secondary" | "default" {
  if (severity === "critical") return "destructive";
  if (severity === "warning")  return "secondary";
  return "default";
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// componente principal
export default function RecursoEnergetico() {
  const { code = "" } = useParams();
  const now = new Date();

  /* filtro de rango */
  const [months, setMonths] = useState(12);

  /* filtro de tipo de combustible (solo aplica para diesel) */
  const [fuelFilter, setFuelFilter] = useState<"all" | "D" | "G">("all");
  const [tablePage,  setTablePage]  = useState(1);

  /* estado reporte PDF */
  const [downloadingReport, setDownloadingReport]       = useState(false);
  const [reportPeriodType,   setReportPeriodType]       = useState<UtilityReportPeriodType>("annual");
  const [reportYear,         setReportYear]             = useState<number>(now.getFullYear());
  const [reportMonth,        setReportMonth]            = useState<number>(now.getMonth() + 1);
  const [reportStartDate,    setReportStartDate]        = useState("");
  const [reportEndDate,      setReportEndDate]          = useState("");

  const { data, isLoading, isError } = useResourceOverview(code, months);

  const ui             = RESOURCE_UI[code];
  const Icon           = ui?.icon ?? Fuel;
  const resourceColors = RESOURCE_COLORS[code] ?? {
    consumo:    "hsl(152 60% 36%)",
    prediccion: "hsl(280 60% 55%)",
    costo:      "hsl(42 90% 52%)",
  };

  const chartConfig = useMemo(
    () => ({
      consumo:    { label: `Consumo (${data?.resource.unit ?? "unidad"})`,    color: resourceColors.consumo    },
      costo:      { label: "Costo (USD)",                                      color: resourceColors.costo      },
      prediccion: { label: `Predicción (${data?.resource.unit ?? "unidad"})`, color: resourceColors.prediccion },
    }),
    [data?.resource.unit, resourceColors.consumo, resourceColors.costo, resourceColors.prediccion],
  );

  /* combina histórico + predicciones en una sola serie para el gráfico */
  const mergedMonthly = useMemo(() => {
    const base = (data?.monthly ?? []).map((item) => ({
      ...item,
      prediccion: null as number | null,
    }));
    const predictions = data?.predictions ?? [];
    return [
      ...base,
      ...predictions.map((pred) => ({
        year:      pred.year,
        month:     pred.month,
        mes:       pred.mes,
        consumo:   null as number | null,
        costo:     null as number | null,
        prediccion: pred.value,
      })),
    ];
  }, [data?.monthly, data?.predictions]);

  /* serie de costos para gráfico de barras */
  const costData = useMemo(
    () => (data?.monthly ?? []).map((item) => ({ mes: item.mes, costo: item.costo })),
    [data?.monthly],
  );

  const fuelBreakdown: FuelBreakdownPoint[] = data?.fuel_breakdown ?? [];
  const hasGasOil = fuelBreakdown.some(r => r.fuel_type === "G");
  const TABLE_PAGE_SIZE = 12;

  const filteredBreakdown = useMemo(() => {
    if (fuelFilter === "all") return fuelBreakdown;
    return fuelBreakdown.filter(r => r.fuel_type === fuelFilter);
  }, [fuelBreakdown, fuelFilter]);

  const totalTablePages = Math.ceil(filteredBreakdown.length / TABLE_PAGE_SIZE);

  const pagedBreakdown = useMemo(
    () => filteredBreakdown.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE),
    [filteredBreakdown, tablePage],
  );

  const filteredChartData = useMemo(() => {
    if (code !== "diesel" || fuelFilter === "all" || !fuelBreakdown.length) return mergedMonthly;
    return fuelBreakdown
      .filter(r => r.fuel_type === fuelFilter)
      .map(r => ({
        year: r.year, month: r.month, mes: r.mes,
        consumo: r.consumo, costo: r.costo,
        prediccion: null as number | null,
      }));
  }, [code, fuelFilter, fuelBreakdown, mergedMonthly]);

  const filteredCostData = useMemo(() => {
    if (code !== "diesel" || fuelFilter === "all" || !fuelBreakdown.length) return costData;
    return fuelBreakdown
      .filter(r => r.fuel_type === fuelFilter)
      .map(r => ({ mes: r.mes, costo: r.costo }));
  }, [code, fuelFilter, fuelBreakdown, costData]);

  const dualChartData = useMemo(() => {
    if (code !== "diesel" || !fuelBreakdown.length) return [];
    const monthMap = new Map<string, { mes: string; consumo_D: number; consumo_G: number; costo_D: number; costo_G: number }>();
    for (const row of fuelBreakdown) {
      const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
      if (!monthMap.has(key)) monthMap.set(key, { mes: row.mes, consumo_D: 0, consumo_G: 0, costo_D: 0, costo_G: 0 });
      const entry = monthMap.get(key)!;
      if (row.fuel_type === "D") { entry.consumo_D += row.consumo; entry.costo_D += row.costo; }
      else                       { entry.consumo_G += row.consumo; entry.costo_G += row.costo; }
    }
    return Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [code, fuelBreakdown]);

  const areasData = useMemo(
    () => (data?.areas ?? []).map(a => ({ ...a, area: VEHICLE_CAT_ES[a.area] ?? a.area })),
    [data?.areas],
  );

  const donutData = useMemo(() => {
    if (!hasGasOil) return [];
    const totalD = fuelBreakdown.filter(r => r.fuel_type === "D").reduce((s, r) => s + r.consumo, 0);
    const totalG = fuelBreakdown.filter(r => r.fuel_type === "G").reduce((s, r) => s + r.consumo, 0);
    const total = totalD + totalG;
    if (total === 0) return [];
    return [
      { name: "Diésel",  value: totalD, pct: ((totalD / total) * 100).toFixed(1), color: "hsl(24 82% 50%)"  },
      { name: "Gas Oil", value: totalG, pct: ((totalG / total) * 100).toFixed(1), color: "hsl(185 75% 45%)" },
    ];
  }, [fuelBreakdown, hasGasOil]);

  /* handlers */
  const onDownloadReport = async () => {
    try {
      setDownloadingReport(true);
      const options =
        reportPeriodType === "range"
          ? { periodType: reportPeriodType, startDate: reportStartDate || undefined, endDate: reportEndDate || undefined }
          : reportPeriodType === "annual"
          ? { periodType: reportPeriodType, year: reportYear }
          : { periodType: reportPeriodType, year: reportYear, month: reportMonth };

      const { blob, filename } = await downloadResourceReport(code, options);
      triggerBlobDownload(blob, filename);
      toast.success(`Reporte PDF de ${ui?.title ?? code} generado`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el reporte PDF");
    } finally {
      setDownloadingReport(false);
    }
  };

  /* validación de código */
  if (!ui) {
    return (
      <DashboardLayout>
        <Card className="p-6">
          <p className="text-sm text-destructive">
            Recurso no encontrado. Verifica el código de la ruta.
          </p>
        </Card>
      </DashboardLayout>
    );
  }

  if (isLoading) return <RecursoSkeleton />;

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* cabecera */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">{ui.title}</h2>
            <p className="text-sm text-muted-foreground">{ui.subtitle}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Organismo regulador: {data?.resource.regulatory_body ?? "N/D"}
            </p>
          </div>
          <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center">
            <Icon className={`h-5 w-5 ${ui.colorClass}`} />
          </div>
        </div>

        {/* filtro de período */}
        <DateRangeFilter selectedMonths={months} onMonthsChange={setMonths} />

        {isError && (
          <Card className="p-4 text-sm text-destructive">
            No se pudo cargar la vista del recurso.
          </Card>
        )}

        {/* badge fuente de datos (emisiones_co2e) */}
        {code === "emisiones_co2e" && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Fuente:</span>
            {data?.data_source === "aggregated_scope1" ? (
              <Badge variant="default" className="bg-emerald-600 text-white hover:bg-emerald-700">
                Datos reales · Scope 1 agregado
              </Badge>
            ) : (
              <Badge variant="secondary">Estimación sintética</Badge>
            )}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(data?.cards ?? []).map((metric, index) => {
            const MetricIcon = index === 0 ? Icon : index === 1 ? TrendingUp : TrendingDown;
            const isRising   = metric.change_pct >= 0;
            return (
              <Card key={`${metric.label}-${index}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MetricIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                    <p className="text-lg font-bold">
                      {metric.value.toLocaleString("es-CL", { maximumFractionDigits: 2 })}{" "}
                      {metric.unit}
                    </p>
                    <p className={`text-xs ${isRising ? "text-destructive" : "text-green-600"}`}>
                      {metric.change_pct.toFixed(1)}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* tendencia mensual */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tendencia Mensual{code !== "diesel" && " y Predicción ML"}</CardTitle>
            </CardHeader>
            <CardContent>
              {code === "diesel" && dualChartData.length > 0 ? (
                <ChartContainer config={DIESEL_CHART_CONFIG} className="h-[300px] w-full">
                  <LineChart data={dualChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="mes" stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                    <YAxis stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="consumo_D" stroke="var(--color-consumo_D)" strokeWidth={2} dot={false} connectNulls name="Diésel (L)" />
                    <Line type="monotone" dataKey="consumo_G" stroke="var(--color-consumo_G)" strokeWidth={2} dot={false} connectNulls name="Gas Oil (L)" />
                  </LineChart>
                </ChartContainer>
              ) : (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <LineChart data={filteredChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="mes" stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                    <YAxis stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="consumo" stroke="var(--color-consumo)" strokeWidth={2} dot={false} connectNulls={false} name={`Consumo real (${data?.resource.unit ?? ""})`} />
                    <Line type="monotone" dataKey="prediccion" stroke="var(--color-prediccion)" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls name={`Predicción ML (${data?.resource.unit ?? ""})`} />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* distribución por área / categoría de vehículo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {code === "diesel" ? "Consumo por Categoría de Vehículo" : "Distribución por Área Funcional"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={areasData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="area" stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <YAxis stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="consumo" fill="var(--color-consumo)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* evolución de costo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolución del Costo Mensual (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            {code === "diesel" && dualChartData.length > 0 ? (
              <ChartContainer config={DIESEL_CHART_CONFIG} className="h-[260px] w-full">
                <BarChart data={dualChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="mes" stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <YAxis stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="costo_D" fill="var(--color-costo_D)" radius={[4, 4, 0, 0]} name="Costo Diésel" />
                  <Bar dataKey="costo_G" fill="var(--color-costo_G)" radius={[4, 4, 0, 0]} name="Costo Gas Oil" />
                </BarChart>
              </ChartContainer>
            ) : (
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <BarChart data={filteredCostData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="mes" stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <YAxis stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="costo" fill="var(--color-costo)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* donut + historial (solo diesel) */}
        {code === "diesel" && donutData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribución por tipo de combustible</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center gap-6">
              <PieChart width={180} height={180}>
                <Pie data={donutData} dataKey="value" innerRadius={52} outerRadius={80} paddingAngle={3}>
                  {donutData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
              <div className="space-y-2 text-sm">
                {donutData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: entry.color }} />
                    <span className="font-medium">{entry.name}</span>
                    <span className="text-muted-foreground">{entry.pct}%</span>
                    <span className="text-muted-foreground">
                      ({entry.value.toLocaleString("es-CL", { maximumFractionDigits: 1 })} L)
                    </span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-1">
                  Total acumulado en el período seleccionado
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* tabla de consumo histórico */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="text-base">
                Historial de Consumo{code === "diesel" ? ": Combustibles de Flota" : `: ${ui.title}`}
              </CardTitle>
              {code === "diesel" && (
                <div className="flex gap-1">
                  {(["all", "D", "G"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => { setFuelFilter(f); setTablePage(1); }}
                      className={`rounded px-3 py-1 text-xs border transition-colors ${
                        fuelFilter === f
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      {f === "all" ? "Toda la flota" : f === "D" ? "Solo Diésel" : "Solo Gas Oil"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(code === "diesel" ? (filteredBreakdown.length > 0 ? filteredBreakdown : data?.monthly ?? []) : data?.monthly ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay datos históricos disponibles para el período seleccionado.
              </p>
            ) : code === "diesel" && filteredBreakdown.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Consumo (L)</TableHead>
                        <TableHead className="text-right">Costo (USD)</TableHead>
                        <TableHead className="text-right">CO₂ (kg)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedBreakdown.map((row) => (
                        <TableRow key={`${row.year}-${row.month}-${row.fuel_type}`}>
                          <TableCell>{row.mes}</TableCell>
                          <TableCell>
                            <span className={`text-xs font-medium ${row.fuel_type === "D" ? "text-amber-600" : "text-cyan-600"}`}>
                              {row.fuel_type === "D" ? "Diésel" : "Gas Oil"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {row.consumo.toLocaleString("es-CL", { maximumFractionDigits: 1 })}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.costo.toLocaleString("es-CL", { maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-orange-600">
                            {row.co2_kg.toLocaleString("es-CL", { maximumFractionDigits: 1 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {totalTablePages > 1 && (
                  <div className="flex items-center justify-between px-1 pt-3 text-xs text-muted-foreground">
                    <span>Página {tablePage} de {totalTablePages} · {filteredBreakdown.length} registros</span>
                    <div className="flex gap-1">
                      <button
                        className="rounded px-2.5 py-1 border hover:bg-muted disabled:opacity-40"
                        disabled={tablePage === 1}
                        onClick={() => setTablePage(p => p - 1)}
                      >
                        ← Anterior
                      </button>
                      <button
                        className="rounded px-2.5 py-1 border hover:bg-muted disabled:opacity-40"
                        disabled={tablePage === totalTablePages}
                        onClick={() => setTablePage(p => p + 1)}
                      >
                        Siguiente →
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">
                        Consumo ({data?.resource.unit ?? "unidad"})
                      </TableHead>
                      <TableHead className="text-right">Costo (USD)</TableHead>
                      <TableHead className="text-right">Var. consumo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.monthly ?? []).map((row, idx, arr) => {
                      const prev = idx > 0 ? arr[idx - 1].consumo : null;
                      const changePct =
                        prev !== null && prev > 0
                          ? ((row.consumo - prev) / prev) * 100
                          : null;
                      return (
                        <TableRow key={`${row.year}-${row.month}`}>
                          <TableCell>{row.mes}</TableCell>
                          <TableCell className="text-right">
                            {row.consumo.toLocaleString("es-CL", { maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.costo.toLocaleString("es-CL", { maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell
                            className={`text-right text-xs ${
                              changePct === null ? "text-muted-foreground" : changePct > 0 ? "text-destructive" : "text-green-600"
                            }`}
                          >
                            {changePct === null ? "primer mes" : `${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}%`}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* reporte PDF */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reporte PDF: {ui.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Genera un informe con consumo histórico, predicciones ML, alertas activas y
              recomendaciones de eficiencia para el período seleccionado.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* período */}
              <div className="space-y-2">
                <Label>Período</Label>
                <Select
                  value={reportPeriodType}
                  onValueChange={(v) => setReportPeriodType(v as UtilityReportPeriodType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensual</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                    <SelectItem value="range">Rango de fechas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* año (mensual / anual) */}
              {(reportPeriodType === "monthly" || reportPeriodType === "annual") && (
                <div className="space-y-2">
                  <Label>Año</Label>
                  <Input
                    type="number"
                    min={2000}
                    max={2100}
                    value={reportYear}
                    onChange={(e) => setReportYear(Number(e.target.value))}
                  />
                </div>
              )}

              {/* mes (solo mensual) */}
              {reportPeriodType === "monthly" && (
                <div className="space-y-2">
                  <Label>Mes</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={reportMonth}
                    onChange={(e) => setReportMonth(Number(e.target.value))}
                  />
                </div>
              )}

              {/* rango de fechas */}
              {reportPeriodType === "range" && (
                <>
                  <div className="space-y-2">
                    <Label>Desde</Label>
                    <Input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hasta</Label>
                    <Input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={onDownloadReport} disabled={downloadingReport}>
                {downloadingReport ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {downloadingReport ? "Generando..." : "Descargar PDF"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* desglose Scope 1 por fuente (solo emisiones_co2e con datos reales) */}
        {code === "emisiones_co2e" && data?.data_source === "aggregated_scope1" && data.scope1_breakdown && Object.keys(data.scope1_breakdown).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Desglose Scope 1 por Fuente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Emisiones directas (GHG Protocol Scope 1) consolidadas desde los recursos de combustión de la instalación.
                Factor de emisión por tipo: diésel 2,74 kg CO₂e/L (HuellaChile MMA 2023) · gas oil 1,89 kg CO₂e/L (IPCC 2006) · gas natural 1,9 kg CO₂e/m³.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 font-medium text-muted-foreground">Fuente</th>
                      <th className="text-right py-1 font-medium text-muted-foreground">tCO₂e acumuladas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.scope1_breakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([sourceCode, tco2e]) => (
                        <tr key={sourceCode} className="border-b last:border-0">
                          <td className="py-1.5">{SCOPE1_LABELS[sourceCode] ?? sourceCode}</td>
                          <td className="py-1.5 text-right font-mono">
                            {tco2e.toLocaleString("es-CL", { maximumFractionDigits: 3 })}
                          </td>
                        </tr>
                      ))}
                    <tr className="font-semibold">
                      <td className="py-1.5 pt-2">Total Scope 1</td>
                      <td className="py-1.5 pt-2 text-right font-mono text-emerald-700 dark:text-emerald-400">
                        {Object.values(data.scope1_breakdown)
                          .reduce((s, v) => s + v, 0)
                          .toLocaleString("es-CL", { maximumFractionDigits: 3 })} tCO₂e
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* alertas activas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas del Recurso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.alerts ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay alertas activas para este recurso.
              </p>
            )}
            {(data?.alerts ?? []).map((alert) => (
              <div
                key={alert.id}
                className="rounded-md border p-3 flex items-start justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.description}</p>
                </div>
                <Badge variant={severityVariant(alert.severity)}>
                  {alert.severity.toUpperCase()}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
