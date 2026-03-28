import { Brain, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Badge } from "@/components/ui/badge";

const predictionData = [
  { mes: "Jul", real: 6200, prediccion: null },
  { mes: "Ago", real: 5900, prediccion: null },
  { mes: "Sep", real: 5500, prediccion: 5600 },
  { mes: "Oct", real: null, prediccion: 5300 },
  { mes: "Nov", real: null, prediccion: 5100 },
  { mes: "Dic", real: null, prediccion: 4900 },
];

const chartConfig = {
  real: { label: "Real (kWh)", color: "hsl(var(--chart-1))" },
  prediccion: { label: "Predicción ML", color: "hsl(var(--chart-3))" },
};

const recommendations = [
  { text: "Reducir climatización en horario nocturno (ahorro estimado: 12%)", type: "high" },
  { text: "Optimizar iluminación en Almacén Norte con sensores de movimiento", type: "medium" },
  { text: "Programar mantenimiento preventivo de compresores", type: "medium" },
  { text: "Migrar servidores a horarios de menor demanda", type: "low" },
];

export default function Predicciones() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Predicciones ML</h2>
          <p className="text-sm text-muted-foreground">Modelos de Machine Learning para pronóstico de consumo</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="p-4 text-center">
            <Brain className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-xs text-muted-foreground">Precisión del Modelo</p>
            <p className="text-2xl font-bold">94.2%</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-xs text-muted-foreground">Ahorro Proyectado</p>
            <p className="text-2xl font-bold">$12,400</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <p className="text-xs text-muted-foreground">Anomalías Detectadas</p>
            <p className="text-2xl font-bold">3</p>
          </CardContent></Card>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Pronóstico de Consumo Eléctrico</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <LineChart data={predictionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" /><YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="real" stroke="var(--color-real)" strokeWidth={2} connectNulls={false} />
                <Line type="monotone" dataKey="prediccion" stroke="var(--color-prediccion)" strokeWidth={2} strokeDasharray="5 5" connectNulls />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recomendaciones de Optimización</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm">{r.text}</p>
                </div>
                <Badge variant={r.type === "high" ? "destructive" : "secondary"}>
                  {r.type === "high" ? "Alta" : r.type === "medium" ? "Media" : "Baja"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}