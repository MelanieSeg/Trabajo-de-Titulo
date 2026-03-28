import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string;
  unit: string;
  change: number;
  icon: LucideIcon;
  color: "green" | "blue" | "yellow" | "red";
}

const colorMap = {
  green: "bg-energy-green-light text-energy-green",
  blue: "bg-energy-blue-light text-energy-blue",
  yellow: "bg-energy-yellow-light text-energy-yellow",
  red: "bg-energy-red-light text-energy-red",
};

export function MetricCard({ title, value, unit, change, icon: Icon, color }: MetricCardProps) {
  const isPositive = change >= 0;

  return (
    <Card className="glass-card metric-glow p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">{value}</span>
            <span className="text-sm text-muted-foreground">{unit}</span>
          </div>
          <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${isPositive ? "text-energy-red" : "text-energy-green"}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{Math.abs(change)}% vs mes anterior</span>
          </div>
        </div>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
