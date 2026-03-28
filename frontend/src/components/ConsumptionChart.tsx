import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { Card } from "@/components/ui/card";
import { TimeseriesPoint } from "@/lib/api";

interface ConsumptionChartProps {
  data: TimeseriesPoint[];
}

const ranges = [
  { key: "1M", months: 1 },
  { key: "3M", months: 3 },
  { key: "6M", months: 6 },
  { key: "1A", months: 12 },
] as const;

export function ConsumptionChart({ data }: ConsumptionChartProps) {
  const [activeRange, setActiveRange] = useState<(typeof ranges)[number]["key"]>("1A");

  const visibleData = useMemo(() => {
    const selected = ranges.find((r) => r.key === activeRange);
    const months = selected?.months ?? 12;
    return data.slice(-Math.max(months + 3, 6));
  }, [activeRange, data]);

  return (
    <Card className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Consumo Mensual</h3>
          <p className="text-xs text-muted-foreground">Electricidad, Agua y Predicciones ML</p>
        </div>
        <div className="flex gap-1">
          {ranges.map((range) => (
            <button
              key={range.key}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${range.key === activeRange ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              onClick={() => setActiveRange(range.key)}
            >
              {range.key}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={visibleData}>
          <defs>
            <linearGradient id="gradElec" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(45, 90%, 55%)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(45, 90%, 55%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradAgua" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(145, 20%, 90%)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(160, 10%, 45%)" />
          <YAxis tick={{ fontSize: 12 }} stroke="hsl(160, 10%, 45%)" />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(145, 20%, 90%)", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />

          <Area
            type="monotone"
            dataKey="electricity_kwh"
            name="Electricidad (kWh)"
            stroke="hsl(45, 90%, 55%)"
            fill="url(#gradElec)"
            strokeWidth={2}
            connectNulls={false}
          />
          <Area
            type="monotone"
            dataKey="water_m3"
            name="Agua (m³)"
            stroke="hsl(200, 70%, 50%)"
            fill="url(#gradAgua)"
            strokeWidth={2}
            connectNulls={false}
          />
          <Area
            type="monotone"
            dataKey="predicted_electricity_kwh"
            name="Predicción Electricidad"
            stroke="hsl(280, 60%, 55%)"
            fill="none"
            strokeWidth={2}
            strokeDasharray="6 3"
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="predicted_water_m3"
            name="Predicción Agua"
            stroke="hsl(160, 55%, 45%)"
            fill="none"
            strokeWidth={2}
            strokeDasharray="4 3"
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
