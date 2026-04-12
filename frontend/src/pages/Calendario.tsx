import { Calendar as CalIcon, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

export default function CalendarioPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const { data, isLoading, isError } = useOperationsOverview();

  const events = data?.calendar ?? [];

  const selectedDayEvents = useMemo(() => {
    if (!date) return events;
    const selected = date.toISOString().slice(0, 10);
    return events.filter((event) => event.date === selected);
  }, [events, date]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Calendario</h2>
          <p className="text-sm text-muted-foreground">Eventos, mantenimientos y fechas clave</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando eventos...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar eventos.</Card>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 flex justify-center">
              <Calendar mode="single" selected={date} onSelect={setDate} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Eventos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedDayEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <CalIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {event.date}
                    </p>
                  </div>
                  <Badge variant="secondary">{event.type}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
