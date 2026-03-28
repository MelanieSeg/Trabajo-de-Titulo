import { Upload, FileText, Brain, Download, Settings, Bell, Target, BarChart3 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { ActivityItem } from "@/lib/api";

interface RecentActivityProps {
  activities: ActivityItem[];
}

function resolveIcon(activityType: string) {
  if (activityType === "etl") return Upload;
  if (activityType === "report") return FileText;
  if (activityType === "ml") return Brain;
  if (activityType === "export") return Download;
  if (activityType === "alert_config") return Bell;
  if (activityType === "target") return Target;
  if (activityType === "custom_metric") return BarChart3;
  return Settings;
}

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

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card className="glass-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Actividad Reciente</h3>
      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = resolveIcon(activity.activity_type);
          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="mt-0.5">
                <Icon className="h-4 w-4 text-energy-green" />
              </div>
              <div>
                <p className="text-sm text-foreground">{activity.message}</p>
                <p className="text-[10px] text-muted-foreground">{relativeTime(activity.created_at)}</p>
              </div>
            </div>
          );
        })}

        {activities.length === 0 && (
          <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
            Aún no hay actividad registrada.
          </div>
        )}
      </div>
    </Card>
  );
}
