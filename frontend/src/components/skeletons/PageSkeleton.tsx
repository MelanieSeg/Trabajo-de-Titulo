import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/DashboardLayout";

/* ── Primitivos internos ─────────────────────────────────────────────────── */

function SkHeader({ titleW = "w-56", subtitleW = "w-80" }: { titleW?: string; subtitleW?: string }) {
  return (
    <div className="space-y-1.5">
      <Skeleton className={`h-7 ${titleW}`} />
      <Skeleton className={`h-4 ${subtitleW}`} />
    </div>
  );
}

function SkKpiCards({ count = 4 }: { count?: number }) {
  return (
    <div
      className={`grid gap-4 ${
        count === 3
          ? "grid-cols-1 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-2 md:grid-cols-4"
      }`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SkChartCard({
  height = 280,
  title = true,
  className = "",
}: {
  height?: number;
  title?: boolean;
  className?: string;
}) {
  return (
    <Card className={`w-full ${className}`}>
      {title && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </CardHeader>
      )}
      <CardContent className={title ? "pt-0" : "p-4"}>
        <Skeleton style={{ height }} className="w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

function SkTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  const baseWidths = ["max-w-[120px]", "max-w-[160px]", "max-w-[100px]", "max-w-[140px]"];
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-44" />
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex items-center gap-4 px-4 py-2.5 border-b bg-muted/30">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className={`h-3.5 flex-1 ${baseWidths[i % baseWidths.length]}`} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b last:border-0">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SkListCard({
  items = 5,
  title = true,
  hasAction = false,
}: {
  items?: number;
  title?: boolean;
  hasAction?: boolean;
}) {
  return (
    <Card>
      {title && (
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
      )}
      <CardContent className={`space-y-2.5 ${title ? "" : "pt-4"}`}>
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg p-3 bg-muted/40">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full shrink-0" />
            {hasAction && <Skeleton className="h-7 w-20 rounded-md shrink-0" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ── Skeletons de página completa ────────────────────────────────────────── */

export function DashboardSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SkHeader titleW="w-80" subtitleW="w-96" />

        {/* Métricas KPI */}
        <SkKpiCards count={4} />

        {/* Acciones rápidas */}
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-32 rounded-md" />
          ))}
        </div>

        {/* Gráfico de consumo (2/3) + distribución (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <SkChartCard height={260} />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent className="flex items-center justify-center pt-2">
              <Skeleton className="h-44 w-44 rounded-full" />
            </CardContent>
          </Card>
        </div>

        {/* Alertas + Eficiencia + Actividad */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkListCard items={4} />
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <Skeleton className="h-20 w-20 rounded-full mx-auto" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
          <SkListCard items={4} />
        </div>
      </div>
    </DashboardLayout>
  );
}

export function ElectricidadSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <SkHeader titleW="w-52" subtitleW="w-72" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
        <SkKpiCards count={4} />
        <SkChartCard height={270} />
        <SkChartCard height={240} />
        <SkTable rows={6} cols={4} />
      </div>
    </DashboardLayout>
  );
}

export function AguaSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <SkHeader titleW="w-44" subtitleW="w-64" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
        <SkKpiCards count={3} />
        <SkChartCard height={270} />
        <SkChartCard height={240} />
        <SkTable rows={6} cols={4} />
      </div>
    </DashboardLayout>
  );
}

export function RecursoSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-3.5 w-72" />
            </div>
          </div>
          <Skeleton className="h-9 w-44 rounded-md" />
        </div>
        <SkKpiCards count={3} />
        <SkChartCard height={280} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkChartCard height={220} />
          <SkChartCard height={220} />
        </div>
        <SkTable rows={6} cols={4} />
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-52" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              <Skeleton className="h-9 w-40 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
              <Skeleton className="h-9 w-32 rounded-md" />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export function PrediccionesMLSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <SkHeader titleW="w-44" subtitleW="w-80" />
          <Skeleton className="h-9 w-40 rounded-md" />
        </div>

        {/* Tarjetas de métricas ML */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Estado del modelo de combustible */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5 min-w-[200px]">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-80 max-w-full" />
              </div>
              <Skeleton className="h-9 w-44 rounded-md shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de series */}
        <SkChartCard height={300} />

        {/* Recomendaciones */}
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg p-3 bg-muted/40">
                <Skeleton className="h-5 w-5 rounded-full shrink-0 mt-0.5" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export function AnomaliasSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <SkHeader titleW="w-40" subtitleW="w-64" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <SkKpiCards count={3} />
        <SkListCard items={5} hasAction={true} />
        <SkTable rows={5} cols={6} />
      </div>
    </DashboardLayout>
  );
}

export function AlertasSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <SkHeader titleW="w-32" subtitleW="w-64" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <SkListCard items={7} hasAction={true} />
      </div>
    </DashboardLayout>
  );
}

export function TendenciasSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <SkHeader titleW="w-44" subtitleW="w-72" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
        <SkChartCard height={320} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export function ComparativasSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SkHeader titleW="w-48" subtitleW="w-80" />
        <SkKpiCards count={3} />
        <SkChartCard height={280} />
        <SkTable rows={5} cols={5} />
      </div>
    </DashboardLayout>
  );
}

export function MetricasSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <SkHeader titleW="w-36" subtitleW="w-64" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

export function KpisSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SkHeader titleW="w-20" subtitleW="w-72" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

export function ObjetivosSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <SkHeader titleW="w-36" subtitleW="w-64" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-7 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-2.5 w-full rounded-full" />
                </div>
                <Skeleton className="h-3 w-36" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

export function ReportesSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SkHeader titleW="w-36" subtitleW="w-72" />
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              <Skeleton className="h-9 w-44 rounded-md" />
              <Skeleton className="h-9 w-32 rounded-md" />
              <Skeleton className="h-9 w-36 rounded-md" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-44" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-8 w-28 rounded-md shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export function UsuariosSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <SkHeader titleW="w-32" subtitleW="w-64" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <SkTable rows={5} cols={5} />
      </div>
    </DashboardLayout>
  );
}

export function ConfiguracionSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SkHeader titleW="w-44" subtitleW="w-72" />
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-60" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-52" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))}
            <Skeleton className="h-9 w-28 rounded-md" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export function EmpresaSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SkHeader titleW="w-40" subtitleW="w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-44" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-28 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export function SeguridadSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SkHeader titleW="w-36" subtitleW="w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkListCard items={3} hasAction={true} />
          <SkListCard items={4} />
        </div>
      </div>
    </DashboardLayout>
  );
}

export function BaseDatosSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SkHeader titleW="w-36" subtitleW="w-64" />
        <SkKpiCards count={3} />
        <SkTable rows={4} cols={4} />
      </div>
    </DashboardLayout>
  );
}

export function ExportarSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SkHeader titleW="w-36" subtitleW="w-56" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-3/4" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-8 w-20 rounded-md" />
                  <Skeleton className="h-8 w-20 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

export function CalendarioSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SkHeader titleW="w-40" subtitleW="w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            </CardContent>
          </Card>
          <SkListCard items={3} />
        </div>
      </div>
    </DashboardLayout>
  );
}

export function MapaSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SkHeader titleW="w-56" subtitleW="w-72" />
        <Card>
          <CardContent className="p-0 overflow-hidden rounded-xl">
            <Skeleton className="h-96 w-full rounded-xl" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Skeleton className="h-12 rounded-lg" />
                  <Skeleton className="h-12 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

export function FiscalizacionSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <SkHeader titleW="w-52" subtitleW="w-80" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
        <SkKpiCards count={4} />
        <SkListCard items={4} hasAction={true} />
        <SkTable rows={4} cols={5} />
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-52" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                <Skeleton className="h-8 w-28 rounded-md shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

/* ── Skeletons parciales (PrediccionesCombustible) ───────────────────────── */

export function ModeloEstadoSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5 min-w-[200px]">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
          <Skeleton className="h-9 w-44 rounded-md shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

export function TransaccionesSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex items-center gap-4 px-4 py-2.5 border-b bg-muted/30">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 flex-1" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b last:border-0">
            {Array.from({ length: 7 }).map((_, j) => (
              <Skeleton key={j} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
