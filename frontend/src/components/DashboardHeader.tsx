import { Bell, Search, AlertTriangle, TrendingUp, Droplets, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardData } from "@/hooks/useDashboardData";
import { AlertItem } from "@/lib/api";
import { ModeToggle } from "./ModeToggle";
import { UserMenu } from "./UserMenu";

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

type SearchTarget = {
  label: string;
  route: string;
  category: string;
  keywords: string[];
};

const searchTargets: SearchTarget[] = [
  { label: "Dashboard", route: "/", category: "Principal", keywords: ["inicio", "resumen", "panel"] },
  { label: "Consumo Eléctrico", route: "/electricidad", category: "Principal", keywords: ["energia", "kwh", "electricidad"] },
  { label: "Consumo de Agua", route: "/agua", category: "Principal", keywords: ["agua", "hidrico", "m3"] },
  { label: "Métricas Generales", route: "/metricas", category: "Principal", keywords: ["metricas", "indicadores", "mediciones"] },
  { label: "Indicadores KPI", route: "/kpis", category: "Principal", keywords: ["kpi", "objetivos", "performance"] },
  { label: "Mapa de Consumo", route: "/mapa", category: "Principal", keywords: ["mapa", "instalaciones", "zonas"] },
  { label: "Predicciones ML", route: "/predicciones", category: "Analítica e IA", keywords: ["predicciones", "machine learning", "modelo"] },
  { label: "Análisis de Tendencias", route: "/tendencias", category: "Analítica e IA", keywords: ["tendencias", "historico", "evolucion"] },
  { label: "Detección Anomalías", route: "/anomalias", category: "Analítica e IA", keywords: ["anomalias", "deteccion", "eventos"] },
  { label: "Comparativas", route: "/comparativas", category: "Analítica e IA", keywords: ["comparar", "periodos", "benchmark"] },
  { label: "Objetivos Energéticos", route: "/objetivos", category: "Analítica e IA", keywords: ["meta", "objetivos", "ahorro"] },
  { label: "Subir Datos", route: "/subir-datos", category: "Gestión de Datos", keywords: ["carga", "csv", "importar"] },
  { label: "Reportes", route: "/reportes", category: "Gestión de Datos", keywords: ["reporte", "informes", "documentos"] },
  { label: "Exportar Datos", route: "/exportar", category: "Gestión de Datos", keywords: ["descargar", "exportar", "xlsx"] },
  { label: "Base de Datos", route: "/base-datos", category: "Gestión de Datos", keywords: ["base", "tabla", "registros"] },
  { label: "Calendario", route: "/calendario", category: "Gestión de Datos", keywords: ["calendario", "agenda", "programacion"] },
  { label: "Alertas", route: "/alertas", category: "Administración", keywords: ["alertas", "notificaciones", "incidencias"] },
  { label: "Usuarios", route: "/usuarios", category: "Administración", keywords: ["usuarios", "roles", "permisos"] },
  { label: "Empresa", route: "/empresa", category: "Administración", keywords: ["empresa", "organizacion", "sucursal"] },
  { label: "Configuración", route: "/configuracion", category: "Administración", keywords: ["configuracion", "ajustes", "preferencias"] },
  { label: "Seguridad", route: "/seguridad", category: "Administración", keywords: ["seguridad", "acceso", "autenticacion"] },
  { label: "Ayuda", route: "/ayuda", category: "Administración", keywords: ["ayuda", "soporte", "faq"] },
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function scoreTarget(target: SearchTarget, query: string) {
  const candidates = [target.label, target.category, ...target.keywords, target.route].map(normalizeText);
  let score = 0;

  candidates.forEach((candidate, index) => {
    if (candidate.startsWith(query)) {
      score += index === 0 ? 6 : 3;
    } else if (candidate.includes(query)) {
      score += index === 0 ? 4 : 2;
    }
  });

  return score;
}

export function DashboardHeader() {
  const { data } = useDashboardData(12);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeResult, setActiveResult] = useState(0);
  const closeSearchRef = useRef<number | null>(null);

  const openAlerts = data?.summary.open_alerts ?? 0;
  const alerts = data?.alerts ?? [];
  const normalizedSearch = normalizeText(search);

  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [];

    return searchTargets
      .map((target) => ({ target, score: scoreTarget(target, normalizedSearch) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.target.label.localeCompare(b.target.label, "es"))
      .slice(0, 8)
      .map((item) => item.target);
  }, [normalizedSearch]);

  const showSearchResults = searchFocused && normalizedSearch.length > 0;

  useEffect(() => {
    setActiveResult(0);
  }, [normalizedSearch]);

  useEffect(() => {
    return () => {
      if (closeSearchRef.current) {
        window.clearTimeout(closeSearchRef.current);
      }
    };
  }, []);

  const goToSearchTarget = (target: SearchTarget) => {
    setSearch("");
    setSearchFocused(false);
    setActiveResult(0);
    navigate(target.route);
  };

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="hidden md:flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 relative">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar métricas, reportes..."
            className="border-0 bg-transparent h-7 w-64 focus-visible:ring-0 text-sm placeholder:text-muted-foreground"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onFocus={() => {
              if (closeSearchRef.current) {
                window.clearTimeout(closeSearchRef.current);
                closeSearchRef.current = null;
              }
              setSearchFocused(true);
            }}
            onBlur={() => {
              closeSearchRef.current = window.setTimeout(() => {
                setSearchFocused(false);
              }, 120);
            }}
            onKeyDown={(event) => {
              if (!showSearchResults) return;
              const hasResults = searchResults.length > 0;

              if (event.key === "ArrowDown" && hasResults) {
                event.preventDefault();
                setActiveResult((current) => (current + 1) % searchResults.length);
                return;
              }

              if (event.key === "ArrowUp" && hasResults) {
                event.preventDefault();
                setActiveResult((current) => (current - 1 + searchResults.length) % searchResults.length);
                return;
              }

              if (event.key === "Enter" && hasResults) {
                event.preventDefault();
                const selected = searchResults[activeResult] ?? searchResults[0];
                if (selected) {
                  goToSearchTarget(selected);
                }
                return;
              }

              if (event.key === "Escape") {
                setSearchFocused(false);
              }
            }}
          />

          {showSearchResults && (
            <div className="absolute left-0 top-[calc(100%+8px)] w-[360px] rounded-lg border bg-popover p-2 shadow-md z-50">
              {searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map((result, index) => (
                    <button
                      key={result.route}
                      type="button"
                      className={`w-full text-left rounded-md px-2 py-2 transition-colors ${
                        index === activeResult ? "bg-accent text-accent-foreground" : "hover:bg-accent/70"
                      }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => goToSearchTarget(result)}
                    >
                      <p className="text-sm font-medium">{result.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{result.category}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground px-2 py-2">No hay secciones relacionadas con tu búsqueda.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ModeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="h-4 w-4" />
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground border-0">
                {openAlerts}
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[360px] p-0">
            <div className="px-3 pt-3 pb-2 flex items-center justify-between">
              <DropdownMenuLabel className="p-0">Alertas Inteligentes</DropdownMenuLabel>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/alertas")}>
                Ver todas
              </Button>
            </div>
            <DropdownMenuSeparator />
            <div className="max-h-80 overflow-y-auto p-2 space-y-2">
              {alerts.map((alert) => {
                const Icon = resolveIcon(alert);
                return (
                  <DropdownMenuItem key={alert.id} className="items-start gap-2 rounded-md p-2 cursor-pointer" onClick={() => navigate("/alertas")}>
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        alert.severity === "critical"
                          ? "bg-energy-red-light"
                          : alert.severity === "warning"
                            ? "bg-energy-yellow-light"
                            : "bg-energy-blue-light"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${
                          alert.severity === "critical"
                            ? "text-energy-red"
                            : alert.severity === "warning"
                              ? "text-energy-yellow"
                              : "text-energy-blue"
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                        <Badge className={`text-[10px] ${badgeColors[alert.severity]}`}>{badgeLabels[alert.severity]}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{relativeTime(alert.created_at)}</p>
                    </div>
                  </DropdownMenuItem>
                );
              })}

              {alerts.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                  Sin alertas activas en este momento.
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <UserMenu />
      </div>
    </header>
  );
}
