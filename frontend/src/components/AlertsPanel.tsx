import { AlertTriangle, TrendingUp, Droplets, Zap, ArrowRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertItem } from "@/lib/api";

interface AlertsPanelProps {
  alerts: AlertItem[];
}

const badgeColors: Record<string, string> = {
  critical: "bg-energy-red-light text-energy-red border-0",
  warning: "bg-energy-yellow-light text-energy-yellow border-0",
  info: "bg-energy-blue-light text-energy-blue border-0",
};

const badgeLabels: Record<string, string> = {
  critical: "Crítico",
  warning: "Advertencia",
  info: "Info",
};

function relativeTime(input: string): string {
  const date = new Date(input);
  const diff = Date.now() - date.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 60) return `Hace ${Math.max(minutes, 1)} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} hora${hours === 1 ? "" : "s"}`;

  const days = Math.floor(hours / 24);
  return `Hace ${days} día${days === 1 ? "" : "s"}`;
}

function resolveIcon(alert: AlertItem) {
  if (alert.utility === "electricity") return Zap;
  if (alert.utility === "water") return Droplets;
  if (alert.severity === "warning") return TrendingUp;
  return AlertTriangle;
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <Card className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Alertas Inteligentes</h3>
        <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary">
          Ver todas <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
      <div className="space-y-3">
        {alerts.map((alert) => {
          const Icon = resolveIcon(alert);
          return (
            <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${alert.severity === "critical" ? "bg-energy-red-light" : alert.severity === "warning" ? "bg-energy-yellow-light" : "bg-energy-blue-light"}`}>
                <Icon className={`h-4 w-4 ${alert.severity === "critical" ? "text-energy-red" : alert.severity === "warning" ? "text-energy-yellow" : "text-energy-blue"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                  <Badge className={`text-[10px] ${badgeColors[alert.severity]}`}>{badgeLabels[alert.severity]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{relativeTime(alert.created_at)}</p>
              </div>
            </div>
          );
        })}

        {alerts.length === 0 && (
          <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
            Sin alertas activas en este momento.
          </div>
        )}
      </div>
    </Card>
  );
}
