import {
  LayoutDashboard, Zap, Droplets, BarChart3, TrendingUp,
  Bell, Settings, FileText, Upload, Users, Building2,
  Leaf, Target, Calendar, Download, Shield, HelpCircle,
  Database, Brain, Gauge, AlertTriangle, PieChart, Map
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Consumo Eléctrico", url: "/electricidad", icon: Zap },
  { title: "Consumo de Agua", url: "/agua", icon: Droplets },
  { title: "Métricas Generales", url: "/metricas", icon: BarChart3 },
  { title: "Indicadores KPI", url: "/kpis", icon: Gauge },
  { title: "Mapa de Consumo", url: "/mapa", icon: Map },
];

const analyticsItems = [
  { title: "Predicciones ML", url: "/predicciones", icon: Brain },
  { title: "Análisis de Tendencias", url: "/tendencias", icon: TrendingUp },
  { title: "Detección Anomalías", url: "/anomalias", icon: AlertTriangle },
  { title: "Comparativas", url: "/comparativas", icon: PieChart },
  { title: "Objetivos Energéticos", url: "/objetivos", icon: Target },
];

const managementItems = [
  { title: "Subir Datos", url: "/subir-datos", icon: Upload },
  { title: "Reportes", url: "/reportes", icon: FileText },
  { title: "Exportar Datos", url: "/exportar", icon: Download },
  { title: "Base de Datos", url: "/base-datos", icon: Database },
  { title: "Calendario", url: "/calendario", icon: Calendar },
];

const adminItems = [
  { title: "Alertas", url: "/alertas", icon: Bell },
  { title: "Usuarios", url: "/usuarios", icon: Users },
  { title: "Empresa", url: "/empresa", icon: Building2 },
  { title: "Configuración", url: "/configuracion", icon: Settings },
  { title: "Seguridad", url: "/seguridad", icon: Shield },
  { title: "Ayuda", url: "/ayuda", icon: HelpCircle },
];

function SidebarSection({ label, items }: { label: string; items: typeof mainItems }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
        {!collapsed && label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end={item.url === "/"}
                  className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                  activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="sidebar-gradient border-r-0">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <Leaf className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold text-sidebar-foreground">EcoEnergy</h1>
              <p className="text-[10px] text-sidebar-foreground/50">Eficiencia Energética</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarSection label="Principal" items={mainItems} />
        <SidebarSection label="Analítica e IA" items={analyticsItems} />
        <SidebarSection label="Gestión de Datos" items={managementItems} />
        <SidebarSection label="Administración" items={adminItems} />
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && (
          <div className="rounded-lg bg-sidebar-accent p-3">
            <p className="text-xs font-medium text-sidebar-foreground">Plan Enterprise</p>
            <p className="text-[10px] text-sidebar-foreground/50 mt-1">Licencia activa hasta Dic 2026</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
