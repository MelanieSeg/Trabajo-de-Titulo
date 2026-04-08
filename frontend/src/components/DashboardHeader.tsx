import { Bell, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDashboardData } from "@/hooks/useDashboardData";
import { ModeToggle } from "./ModeToggle";
import { UserMenu } from "./UserMenu";

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
        <ModeToggle />
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground border-0">
            {openAlerts}
          </Badge>
        </Button>

        <UserMenu />
      </div>
    </header>
  );
}
