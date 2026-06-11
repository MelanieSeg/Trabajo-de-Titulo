import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

import { Card } from "@/components/ui/card";
import { DistributionItem } from "@/lib/api";

interface DistributionChartProps {
  data: DistributionItem[];
}

const colors = [
  "hsl(152, 60%, 36%)",
  "hsl(200, 70%, 50%)",
  "hsl(45, 90%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(160, 10%, 70%)",
];

export function DistributionChart({ data }: DistributionChartProps) {
  const chartData = data.map((item, index) => ({
    ...item,
    color: colors[index % colors.length],
  }));

  return (
    <Card className="glass-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Distribución por Área</h3>
      <p className="text-xs text-muted-foreground mb-4">Consumo eléctrico actual</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-xs">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="font-medium text-foreground ml-auto">{Number(item.value).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
