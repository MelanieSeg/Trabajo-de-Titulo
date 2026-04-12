import { Bell, Search, AlertTriangle, TrendingUp, Droplets, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

export function DashboardHeader() {
  const { data } = useDashboardData(12);
  const navigate = useNavigate();

  const openAlerts = data?.summary.open_alerts ?? 0;
  const alerts = data?.alerts ?? [];

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="hidden md:flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar métricas, reportes..."
            className="border-0 bg-transparent h-7 w-64 focus-visible:ring-0 text-sm placeholder:text-muted-foreground"
          />
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
