import { useMemo } from "react";
import {
  Cloud,
  DollarSign,
  Droplets,
  Factory,
  FlaskConical,
  Flame,
  Fuel,
  Leaf,
  LucideIcon,
  Recycle,
  Wind,
  Zap,
} from "lucide-react";

import { MetricCard } from "@/components/MetricCard";
import { SummaryMetric } from "@/lib/api";

type MetricColor = "green" | "blue" | "yellow" | "red";

const metricVisuals: Record<string, { icon: LucideIcon; color: MetricColor }> = {
  Electricidad: { icon: Zap, color: "yellow" },
  Agua: { icon: Droplets, color: "blue" },
  "Gas Natural": { icon: Fuel, color: "green" },
  "Diésel": { icon: Factory, color: "red" },
  Gasolina: { icon: Flame, color: "red" },
  "GLP / Propano": { icon: Wind, color: "blue" },
  "Vapor / Energía Térmica": { icon: Factory, color: "red" },
  "Energía Renovable Generada": { icon: Leaf, color: "green" },
  "Residuos Totales": { icon: Recycle, color: "green" },
  "Emisiones Reales de CO2e": { icon: Cloud, color: "red" },
  "Químicos y Consumibles": { icon: FlaskConical, color: "blue" },
  "Costo Total": { icon: DollarSign, color: "red" },
  "CO₂ Evitado": { icon: Leaf, color: "green" },
};

interface EnergyMetricsCarouselProps {
  metrics: SummaryMetric[];
}

function formatMetricValue(metric: SummaryMetric): string {
  const maxDecimals = metric.value >= 1000 ? 0 : 2;
  return metric.value.toLocaleString("es-CL", { maximumFractionDigits: maxDecimals });
}

export function EnergyMetricsCarousel({ metrics }: EnergyMetricsCarouselProps) {
  const baseMetrics = metrics ?? [];

  const isCarouselEnabled = baseMetrics.length > 4;
  const loopMetrics = useMemo(
    () => (isCarouselEnabled ? [...baseMetrics, ...baseMetrics] : baseMetrics),
    [baseMetrics, isCarouselEnabled]
  );

  const durationSec = useMemo(() => Math.max(42, baseMetrics.length * 7), [baseMetrics.length]);

  if (!isCarouselEnabled) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {baseMetrics.map((metric) => {
          const visual = metricVisuals[metric.title] ?? { icon: Zap, color: "green" as MetricColor };
          return (
            <MetricCard
              key={metric.title}
              title={metric.title}
              value={formatMetricValue(metric)}
              unit={metric.unit}
              change={metric.change_pct}
              icon={visual.icon}
              color={visual.color}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="energy-carousel"
      style={
        {
          "--energy-items": loopMetrics.length,
          "--energy-duration": `${durationSec}s`,
        } as React.CSSProperties
      }
    >
      <div className="energy-carousel-track">
        {loopMetrics.map((metric, index) => {
          const visual = metricVisuals[metric.title] ?? { icon: Zap, color: "green" as MetricColor };
          return (
            <div key={`${metric.title}-${index}`} className="energy-carousel-item">
              <MetricCard
                title={metric.title}
                value={formatMetricValue(metric)}
                unit={metric.unit}
                change={metric.change_pct}
                icon={visual.icon}
                color={visual.color}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

