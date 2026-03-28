import { Calendar as CalIcon, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const events = [
  { date: "2025-10-01", title: "Revisión mensual de consumo", type: "Reunión" },
  { date: "2025-10-05", title: "Mantenimiento preventivo HVAC", type: "Mantenimiento" },
  { date: "2025-10-10", title: "Auditoría energética externa", type: "Auditoría" },
  { date: "2025-10-15", title: "Entrega reporte trimestral", type: "Reporte" },
  { date: "2025-10-20", title: "Capacitación personal — eficiencia", type: "Capacitación" },
];

export default function CalendarioPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Calendario</h2>
          <p className="text-sm text-muted-foreground">Eventos, mantenimientos y fechas clave</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 flex justify-center">
              <Calendar mode="single" selected={date} onSelect={setDate} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Próximos Eventos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {events.map((e) => (
                <div key={e.title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <CalIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{e.date}</p>
                  </div>
                  <Badge variant="secondary">{e.type}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}