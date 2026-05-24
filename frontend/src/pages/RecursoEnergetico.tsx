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
  Legend,
  Line,
  LineChart,
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
import { downloadResourceReport, UtilityReportPeriodType } from "@/lib/api";
import { toast } from "sonner";

/* ─── estilos de gráficos ─────────────────────────────────────────────── */
const axisStroke = "hsl(var(--muted-foreground))";
const gridStroke  = "hsl(var(--border))";
const tickStyle   = { fill: "hsl(var(--foreground))", fontSize: 12 };

/* ─── catálogo de recursos ────────────────────────────────────────────── */
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
    title: "Consumo de Diésel",
    subtitle: "Basado en transacciones reales de flota registradas en el sistema",
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

/* ─── componente principal ────────────────────────────────────────────── */
export default function RecursoEnergetico() {
  const { code = "" } = useParams();
  const now = new Date();

  /* filtro de rango */
  const [months, setMonths] = useState(12);

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

  /* ── handlers ── */
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

  /* ── validación de código ── */
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

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── cabecera ── */}
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

        {/* ── filtro de período ── */}
        <DateRangeFilter selectedMonths={months} onMonthsChange={setMonths} />

        {isLoading && (
          <Card className="p-4 text-sm text-muted-foreground">Cargando datos del recurso...</Card>
        )}
        {isError && (
          <Card className="p-4 text-sm text-destructive">
            No se pudo cargar la vista del recurso.
          </Card>
        )}

        {/* ── KPI cards ── */}
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

        {/* ── gráficos ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* tendencia mensual + predicción ML */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tendencia Mensual y Predicción ML</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <LineChart data={mergedMonthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="mes" stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <YAxis stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="consumo"
                    stroke="var(--color-consumo)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    name={`Consumo real (${data?.resource.unit ?? ""})`}
                  />
                  <Line
                    type="monotone"
                    dataKey="prediccion"
                    stroke="var(--color-prediccion)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    connectNulls
                    name={`Predicción ML (${data?.resource.unit ?? ""})`}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* distribución por área / categoría de vehículo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {code === "diesel"
                  ? "Consumo por Categoría de Vehículo"
                  : "Distribución por Área Funcional"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={data?.areas ?? []}>
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

        {/* ── evolución de costo ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolución del Costo Mensual (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart data={costData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="mes" stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                <YAxis stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="costo" fill="var(--color-costo)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* ── tabla de consumo histórico ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Historial de Consumo: {ui.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.monthly ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay datos históricos disponibles para el período seleccionado.
              </p>
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
                              changePct === null
                                ? "text-muted-foreground"
                                : changePct > 0
                                ? "text-destructive"
                                : "text-green-600"
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

        {/* ── reporte PDF ── */}
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

        {/* ── alertas activas ── */}
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
