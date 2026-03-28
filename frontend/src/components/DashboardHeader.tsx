import { Bell, Search, User, ChevronDown } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDashboardData } from "@/hooks/useDashboardData";

export function DashboardHeader() {
  const { data } = useDashboardData(12);
  const openAlerts = data?.summary.open_alerts ?? 0;

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
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground border-0">
            {openAlerts}
          </Badge>
        </Button>

        <div className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l cursor-pointer hover:bg-muted rounded-lg px-2 py-1 transition-colors">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-medium">Admin</p>
            <p className="text-xs text-muted-foreground">admin@empresa.com</p>
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}
