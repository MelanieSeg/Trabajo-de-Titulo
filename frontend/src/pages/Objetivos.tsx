import { Target, CheckCircle, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const goals = [
  { name: "Reducir consumo eléctrico 15%", progress: 68, deadline: "Dic 2025", status: "En progreso" },
  { name: "Reducir consumo de agua 10%", progress: 45, deadline: "Dic 2025", status: "En progreso" },
  { name: "Implementar paneles solares", progress: 90, deadline: "Mar 2026", status: "Casi listo" },
  { name: "Certificación ISO 50001", progress: 30, deadline: "Jun 2026", status: "En progreso" },
  { name: "Zero waste en oficinas", progress: 55, deadline: "Sep 2025", status: "En progreso" },
  { name: "Reducir huella de carbono 20%", progress: 72, deadline: "Dic 2025", status: "En progreso" },
];

export default function Objetivos() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Objetivos Energéticos</h2>
          <p className="text-sm text-muted-foreground">Seguimiento de metas de eficiencia y sostenibilidad</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((g) => (
            <Card key={g.name}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />{g.name}
                  </CardTitle>
                  <Badge variant="secondary">{g.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>{g.progress}% completado</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{g.deadline}</span>
                </div>
                <Progress value={g.progress} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}