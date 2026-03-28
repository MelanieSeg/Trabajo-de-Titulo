import { BarChart3, Zap, Droplets, DollarSign, Leaf, Activity } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const metrics = [
  { label: "Eficiencia Energética", value: 82, target: 90, icon: Zap, color: "bg-yellow-500" },
  { label: "Eficiencia Hídrica", value: 76, target: 85, icon: Droplets, color: "bg-blue-500" },
  { label: "Reducción de Costos", value: 65, target: 80, icon: DollarSign, color: "bg-red-500" },
  { label: "Huella de Carbono", value: 71, target: 75, icon: Leaf, color: "bg-green-500" },
  { label: "Rendimiento General", value: 78, target: 85, icon: Activity, color: "bg-purple-500" },
  { label: "Cumplimiento Normativo", value: 92, target: 95, icon: BarChart3, color: "bg-indigo-500" },
];

export default function Metricas() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Métricas Generales</h2>
          <p className="text-sm text-muted-foreground">Indicadores clave de rendimiento energético</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((m) => (
            <Card key={m.label}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-lg ${m.color}/10 flex items-center justify-center`}>
                    <m.icon className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-sm">{m.label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-2xl font-bold">{m.value}%</span>
                  <span className="text-xs text-muted-foreground">Meta: {m.target}%</span>
                </div>
                <Progress value={m.value} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}