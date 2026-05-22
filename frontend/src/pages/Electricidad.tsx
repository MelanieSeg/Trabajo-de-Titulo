import { Zap, TrendingUp, TrendingDown, Upload, Loader2, Download } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { useRef, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";
import { Button } from "@/components/ui/button";
import {
  downloadUtilityConsumptionReport,
  runMlTraining,
  uploadElectricityCsv,
  UtilityReportPeriodType,
} from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const chartConfig = {
  consumo: {
    label: "Consumo (kWh)",
    color: "hsl(45 95% 52%)",
  },
  costo: {
    label: "Costo (USD)",
    color: "hsl(26 82% 50%)",
  },
  prediccion: {
    label: "Predicción (kWh)",
    color: "hsl(275 62% 52%)",
  },
  sinSoftware: {
    label: "Sin software (USD)",
    color: "hsl(15 78% 52%)",
  },
  optimizado: {
    label: "Con software / optimizado (USD)",
    color: "hsl(145 60% 42%)",
  },
};

const axisStroke = "hsl(var(--muted-foreground))";
const gridStroke = "hsl(var(--border))";
const tickStyle = { fill: "hsl(var(--foreground))", fontSize: 12 };

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Electricidad() {
  const now = new Date();
  const [months, setMonths] = useState(12);
  const [uploading, setUploading] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [reportPeriodType, setReportPeriodType] = useState<UtilityReportPeriodType>("monthly");
  const [reportYear, setReportYear] = useState<number>(now.getFullYear());
  const [reportMonth, setReportMonth] = useState<number>(now.getMonth() + 1);
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useOperationsOverview(months);

  const cards = data?.electricity.cards ?? [];
  const monthlyData = data?.electricity.monthly ?? [];
  const areaData = data?.electricity.areas ?? [];
  const trendData = (data?.timeseries ?? []).map((item) => ({
    mes: item.label,
    consumo: item.energy_values?.electricity ?? item.electricity_kwh,
    prediccion: item.energy_predictions?.electricity ?? item.predicted_electricity_kwh,
  }));
  const annualComparisonData = (data?.comparisons?.rows ?? []).map((item) => ({
    periodo: item.periodo,
    sinSoftware: item.electricity_cost_without_software_usd,
    optimizado: item.electricity_cost_with_software_usd,
  }));
  const comparisonRows = data?.comparisons?.rows ?? [];
  const comparisonSummary = data?.comparisons?.summary;

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const etlResult = await uploadElectricityCsv(file);
      await queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });

      let accuracyText = "";
      try {
        const mlResult = await runMlTraining(3);
        accuracyText = ` · precisión ${Number(mlResult.accuracy_pct.electricity ?? 0).toFixed(1)}%`;
      } catch (mlError) {
        toast.error(mlError instanceof Error ? mlError.message : "No se pudo reentrenar ML después de la carga");
      } finally {
        await queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
        await queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      }

      toast.success(`Carga eléctrica lista: ${etlResult.rows_processed} filas${accuracyText}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar CSV eléctrico");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const onDownloadReport = async () => {
    try {
      setDownloadingReport(true);
      const options =
        reportPeriodType === "range"
          ? {
              periodType: reportPeriodType,
              startDate: reportStartDate || undefined,
              endDate: reportEndDate || undefined,
            }
          : reportPeriodType === "annual"
            ? {
                periodType: reportPeriodType,
                year: reportYear,
              }
            : {
                periodType: reportPeriodType,
                year: reportYear,
                month: reportMonth,
              };

      const { blob, filename } = await downloadUtilityConsumptionReport("electricity", options);
      triggerBlobDownload(blob, filename);
      toast.success("Reporte PDF de electricidad generado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el reporte PDF");
    } finally {
      setDownloadingReport(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Consumo Eléctrico</h2>
          <p className="text-sm text-muted-foreground">Análisis detallado del consumo de electricidad</p>
        </div>

        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Cargar CSV de Electricidad</p>
              <p className="text-xs text-muted-foreground">
                Desde esta vista se procesa solo el módulo eléctrico y luego se reentrena ML.
              </p>
            </div>
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onFileSelected} />
            <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? "Procesando..." : "Subir CSV Eléctrico"}
            </Button>
          </CardContent>
        </Card>

        <DateRangeFilter selectedMonths={months} onMonthsChange={setMonths} />

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando datos reales...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudo cargar la vista eléctrica.</Card>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map((metric, index) => {
            const Icon = index === 0 ? Zap : index === 1 ? TrendingUp : TrendingDown;
            return (
              <Card key={metric.label}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                    <p className="text-lg font-bold">
                      {metric.value.toLocaleString("es-CL", { maximumFractionDigits: 1 })} {metric.unit}
                    </p>
                    <p className={`text-xs ${metric.change_pct > 0 ? "text-destructive" : "text-green-600"}`}>
                      {metric.change_pct.toFixed(1)}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tendencia Mensual</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <LineChart data={trendData.length > 0 ? trendData : monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="mes" stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <YAxis stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="consumo"
                    stroke="var(--color-consumo)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="prediccion"
                    stroke="var(--color-prediccion)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consumo por Área</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={areaData}>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparativa Anual de Costos Eléctricos</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart data={annualComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="periodo" stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                <YAxis stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="sinSoftware" fill="var(--color-sinSoftware)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="optimizado" fill="var(--color-optimizado)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Costos Sin Optimización (Solo Escenario Rojo)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart data={annualComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="periodo" stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                <YAxis stroke={axisStroke} tick={tickStyle} tickLine={{ stroke: axisStroke }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="sinSoftware" fill="var(--color-sinSoftware)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reporte PDF (Electricidad)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label>Período</Label>
                <Select value={reportPeriodType} onValueChange={(value) => setReportPeriodType(value as UtilityReportPeriodType)}>
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

              {(reportPeriodType === "monthly" || reportPeriodType === "annual") && (
                <div className="space-y-2">
                  <Label>Año</Label>
                  <Input
                    type="number"
                    min={2000}
                    max={2100}
                    value={reportYear}
                    onChange={(event) => setReportYear(Number(event.target.value))}
                  />
                </div>
              )}

              {reportPeriodType === "monthly" && (
                <div className="space-y-2">
                  <Label>Mes</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={reportMonth}
                    onChange={(event) => setReportMonth(Number(event.target.value))}
                  />
                </div>
              )}

              {reportPeriodType === "range" && (
                <>
                  <div className="space-y-2">
                    <Label>Desde</Label>
                    <Input
                      type="date"
                      value={reportStartDate}
                      onChange={(event) => setReportStartDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hasta</Label>
                    <Input
                      type="date"
                      value={reportEndDate}
                      onChange={(event) => setReportEndDate(event.target.value)}
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tabla de Costos Eléctricos: Sin vs Con Software</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Ahorro histórico:{" "}
                <span className="font-semibold text-foreground">
                  USD {Number(comparisonSummary?.historical_savings_usd ?? 0).toLocaleString("es-CL", { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Ahorro futuro proyectado:{" "}
                <span className="font-semibold text-foreground">
                  USD {Number(comparisonSummary?.future_savings_usd ?? 0).toLocaleString("es-CL", { maximumFractionDigits: 2 })}
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Año</TableHead>
                    <TableHead>Escenario</TableHead>
                    <TableHead className="text-right">Sin software (USD)</TableHead>
                    <TableHead className="text-right">Con software (USD)</TableHead>
                    <TableHead className="text-right">Ahorro (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonRows.map((row) => (
                    <TableRow key={`elec-cost-${row.year}`}>
                      <TableCell>{row.periodo}</TableCell>
                      <TableCell>{row.scenario_type === "predictive" ? "Predictivo" : "Histórico"}</TableCell>
                      <TableCell className="text-right">
                        {Number(row.electricity_cost_without_software_usd).toLocaleString("es-CL", { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(row.electricity_cost_with_software_usd).toLocaleString("es-CL", { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {Number(
                          row.electricity_cost_without_software_usd - row.electricity_cost_with_software_usd,
                        ).toLocaleString("es-CL", { maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tabla de Consumo Eléctrico: Sin vs Con Software</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Año</TableHead>
                    <TableHead>Escenario</TableHead>
                    <TableHead className="text-right">Sin software (kWh)</TableHead>
                    <TableHead className="text-right">Con software (kWh)</TableHead>
                    <TableHead className="text-right">Mejora (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonRows.map((row) => {
                    const without = Number(row.electricity_kwh_without_software ?? 0);
                    const withSoftware = Number(row.electricity_kwh_with_software ?? 0);
                    const gainPct = without > 0 ? ((without - withSoftware) / without) * 100 : 0;
                    return (
                      <TableRow key={`elec-cons-${row.year}`}>
                        <TableCell>{row.periodo}</TableCell>
                        <TableCell>{row.scenario_type === "predictive" ? "Predictivo" : "Histórico"}</TableCell>
                        <TableCell className="text-right">
                          {without.toLocaleString("es-CL", { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          {withSoftware.toLocaleString("es-CL", { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-green-600">{gainPct.toFixed(2)}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
