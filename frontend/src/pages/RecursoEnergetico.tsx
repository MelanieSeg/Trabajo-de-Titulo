import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertTriangle,
  Droplets,
  Factory,
  FlaskConical,
  Fuel,
  Gauge,
  Leaf,
  TrendingDown,
  TrendingUp,
  Wind,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { DashboardLayout } from "@/components/DashboardLayout";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useResourceOverview } from "@/hooks/useResourceOverview";

const axisStroke = "hsl(var(--muted-foreground))";
const gridStroke = "hsl(var(--border))";
const tickStyle = { fill: "hsl(var(--foreground))", fontSize: 12 };

const RESOURCE_UI: Record<
  string,
  { title: string; subtitle: string; icon: typeof Fuel; colorClass: string }
> = {
  gas_natural: {
    title: "Gas Natural",
    subtitle: "Fiscalizado por SEC y normativas ambientales",
    icon: Fuel,
    colorClass: "text-emerald-600",
  },
  diesel: {
    title: "Diésel",
    subtitle: "Combustible fósil en procesos y respaldo energético",
    icon: Factory,
    colorClass: "text-amber-600",
  },
  gasolina: {
    title: "Gasolina",
    subtitle: "Consumo en flota y equipos auxiliares",
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
  gas_natural: {
    consumo: "hsl(140 60% 45%)",
    prediccion: "hsl(140 50% 35%)",
    costo: "hsl(42 90% 52%)",
  },
  diesel: {
    consumo: "hsl(24 82% 50%)",
    prediccion: "hsl(24 72% 40%)",
    costo: "hsl(42 90% 52%)",
  },
  gasolina: {
    consumo: "hsl(12 78% 52%)",
    prediccion: "hsl(12 68% 42%)",
    costo: "hsl(42 90% 52%)",
  },
  glp_propano: {
    consumo: "hsl(185 75% 45%)",
    prediccion: "hsl(185 65% 35%)",
    costo: "hsl(42 90% 52%)",
  },
  vapor_termica: {
    consumo: "hsl(8 70% 52%)",
    prediccion: "hsl(8 60% 42%)",
    costo: "hsl(42 90% 52%)",
  },
  energia_renovable: {
    consumo: "hsl(122 58% 44%)",
    prediccion: "hsl(122 50% 34%)",
    costo: "hsl(42 90% 52%)",
  },
  residuos: {
    consumo: "hsl(210 12% 48%)",
    prediccion: "hsl(210 12% 36%)",
    costo: "hsl(42 90% 52%)",
  },
  emisiones_co2e: {
    consumo: "hsl(340 78% 52%)",
    prediccion: "hsl(340 68% 42%)",
    costo: "hsl(42 90% 52%)",
  },
  quimicos_consumibles: {
    consumo: "hsl(275 62% 52%)",
    prediccion: "hsl(275 52% 42%)",
    costo: "hsl(42 90% 52%)",
  },
};

function severityVariant(severity: string): "destructive" | "secondary" | "default" {
  if (severity === "critical") return "destructive";
  if (severity === "warning") return "secondary";
  return "default";
}

export default function RecursoEnergetico() {
  const { code = "" } = useParams();
  const [months, setMonths] = useState(12);
  const { data, isLoading, isError } = useResourceOverview(code, months);

  const ui = RESOURCE_UI[code];
  const Icon = ui?.icon ?? Fuel;
  const resourceColors = RESOURCE_COLORS[code] ?? {
    consumo: "hsl(152 60% 36%)",
    prediccion: "hsl(280 60% 55%)",
    costo: "hsl(42 90% 52%)",
  };

  const chartConfig = useMemo(
    () => ({
      consumo: {
        label: `Consumo (${data?.resource.unit ?? "unidad"})`,
        color: resourceColors.consumo,
      },
      costo: {
        label: "Costo (USD)",
        color: resourceColors.costo,
      },
      prediccion: {
        label: `Predicción (${data?.resource.unit ?? "unidad"})`,
        color: resourceColors.prediccion,
      },
    }),
    [data?.resource.unit, resourceColors.consumo, resourceColors.costo, resourceColors.prediccion]
  );

  const mergedMonthly = useMemo(() => {
    const base = (data?.monthly ?? []).map((item) => ({
      ...item,
      prediccion: null as number | null,
    }));
    const predictions = data?.predictions ?? [];
    return [
      ...base,
      ...predictions.map((pred) => ({
        year: pred.year,
        month: pred.month,
        mes: pred.mes,
        consumo: null as number | null,
        costo: null as number | null,
        prediccion: pred.value,
      })),
    ];
  }, [data?.monthly, data?.predictions]);

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

        <DateRangeFilter selectedMonths={months} onMonthsChange={setMonths} />

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando datos del recurso...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudo cargar la vista del recurso.</Card>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(data?.cards ?? []).map((metric, index) => {
            const MetricIcon = index === 0 ? Icon : index === 1 ? TrendingUp : TrendingDown;
            const isRising = metric.change_pct >= 0;
            return (
              <Card key={`${metric.label}-${index}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MetricIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                    <p className="text-lg font-bold">
                      {metric.value.toLocaleString("es-CL", { maximumFractionDigits: 2 })} {metric.unit}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tendencia Mensual y Predicción</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <LineChart data={mergedMonthly}>
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
                    connectNulls={false}
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
              <CardTitle className="text-base">Distribución por Área Funcional</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas del Recurso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.alerts ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No hay alertas activas para este recurso.</p>
            )}
            {(data?.alerts ?? []).map((alert) => (
              <div key={alert.id} className="rounded-md border p-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.description}</p>
                </div>
                <Badge variant={severityVariant(alert.severity)}>{alert.severity.toUpperCase()}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
