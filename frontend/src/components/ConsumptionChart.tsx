import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/card";
import { TimeseriesPoint } from "@/lib/api";

interface EnergySeriesItem {
  code: string;
  label: string;
  unit: string;
}

interface ConsumptionChartProps {
  data: TimeseriesPoint[];
  energyCatalog?: EnergySeriesItem[];
  title?: string;
  subtitle?: string;
  height?: number;
}

const ranges = [
  { key: "1M", months: 1 },
  { key: "3M", months: 3 },
  { key: "6M", months: 6 },
  { key: "1A", months: 12 },
] as const;

const ENERGY_COLORS: Record<string, string> = {
  electricity: "hsl(45 95% 52%)",
  water: "hsl(200 85% 48%)",
  gas_natural: "hsl(140 60% 45%)",
  diesel: "hsl(20 82% 47%)",
  gasolina: "hsl(12 78% 52%)",
  glp_propano: "hsl(185 75% 45%)",
  vapor_termica: "hsl(8 70% 52%)",
  energia_renovable: "hsl(122 58% 44%)",
  residuos: "hsl(210 12% 48%)",
  emisiones_co2e: "hsl(340 78% 52%)",
  quimicos_consumibles: "hsl(275 62% 52%)",
};

const FALLBACK_COLORS = [
  "hsl(12 82% 55%)",
  "hsl(39 93% 50%)",
  "hsl(80 65% 45%)",
  "hsl(130 60% 42%)",
  "hsl(170 68% 42%)",
  "hsl(210 80% 48%)",
  "hsl(245 76% 58%)",
  "hsl(282 62% 55%)",
  "hsl(320 70% 52%)",
];

function defaultCatalogFromData(data: TimeseriesPoint[]): EnergySeriesItem[] {
  const keys = new Set<string>();
  data.forEach((point) => {
    Object.keys(point.energy_values ?? {}).forEach((key) => keys.add(key));
    if (point.electricity_kwh !== null) keys.add("electricity");
    if (point.water_m3 !== null) keys.add("water");
  });

  const fallbackMap: Record<string, EnergySeriesItem> = {
    electricity: { code: "electricity", label: "Electricidad", unit: "kWh" },
    water: { code: "water", label: "Agua", unit: "m³" },
  };

  return Array.from(keys).map((code) => fallbackMap[code] ?? { code, label: code, unit: "" });
}

function valueForCode(point: TimeseriesPoint, code: string): number | null {
  if (point.energy_values && code in point.energy_values) {
    return point.energy_values[code] ?? null;
  }
  if (code === "electricity") return point.electricity_kwh;
  if (code === "water") return point.water_m3;
  return null;
}

function predictionForCode(point: TimeseriesPoint, code: string): number | null {
  if (point.energy_predictions && code in point.energy_predictions) {
    return point.energy_predictions[code] ?? null;
  }
  if (code === "electricity") return point.predicted_electricity_kwh;
  if (code === "water") return point.predicted_water_m3;
  return null;
}

export function ConsumptionChart({
  data,
  energyCatalog,
  title = "Consumo Mensual",
  subtitle = "Electricidad, Agua y Predicciones ML",
  height = 320,
}: ConsumptionChartProps) {
  const [activeRange, setActiveRange] = useState<(typeof ranges)[number]["key"]>("1A");

  const visibleData = useMemo(() => {
    const selected = ranges.find((range) => range.key === activeRange);
    const months = selected?.months ?? 12;
    return data.slice(-Math.max(months + 3, 6));
  }, [activeRange, data]);

  const seriesCatalog = useMemo(() => {
    if (energyCatalog && energyCatalog.length > 0) {
      return energyCatalog;
    }
    return defaultCatalogFromData(data);
  }, [data, energyCatalog]);

  const paletteByCode = useMemo(() => {
    const map: Record<string, string> = {};
    seriesCatalog.forEach((item, index) => {
      map[item.code] = ENERGY_COLORS[item.code] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
    });
    return map;
  }, [seriesCatalog]);

  const chartData = useMemo(
    () =>
      visibleData.map((point) => {
        const row: Record<string, string | number | null> = {
          label: point.label,
        };
        seriesCatalog.forEach((item) => {
          row[`real_${item.code}`] = valueForCode(point, item.code);
          row[`pred_${item.code}`] = predictionForCode(point, item.code);
        });
        return row;
      }),
    [seriesCatalog, visibleData]
  );

  return (
    <Card className="glass-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex gap-1">
          {ranges.map((range) => (
            <button
              key={range.key}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                range.key === activeRange
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setActiveRange(range.key)}
              type="button"
            >
              {range.key}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(145 20% 90%)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(160 10% 45%)" />
          <YAxis tick={{ fontSize: 12 }} stroke="hsl(160 10% 45%)" />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid hsl(145 20% 90%)",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />

          {seriesCatalog.map((item) => {
            const color = paletteByCode[item.code];
            return (
              <Line
                key={`real_${item.code}`}
                type="monotone"
                dataKey={`real_${item.code}`}
                name={`${item.label} (${item.unit})`}
                stroke={color}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            );
          })}

          {seriesCatalog.map((item) => {
            const color = paletteByCode[item.code];
            return (
              <Line
                key={`pred_${item.code}`}
                type="monotone"
                dataKey={`pred_${item.code}`}
                name={`Predicción ${item.label}`}
                stroke={color}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

