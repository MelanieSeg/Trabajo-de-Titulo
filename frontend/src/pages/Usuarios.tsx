import { Users, UserPlus, Shield, Mail } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const users = [
  { name: "Carlos Mendoza", email: "carlos@empresa.com", role: "Admin", status: "Activo", initials: "CM" },
  { name: "Ana García", email: "ana@empresa.com", role: "Analista", status: "Activo", initials: "AG" },
  { name: "Roberto López", email: "roberto@empresa.com", role: "Operador", status: "Activo", initials: "RL" },
  { name: "María Torres", email: "maria@empresa.com", role: "Visualizador", status: "Activo", initials: "MT" },
  { name: "Juan Pérez", email: "juan@empresa.com", role: "Analista", status: "Inactivo", initials: "JP" },
];

export default function UsuariosPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Usuarios</h2>
            <p className="text-sm text-muted-foreground">Gestión de usuarios y permisos</p>
          </div>
          <Button><UserPlus className="h-4 w-4 mr-2" />Agregar Usuario</Button>
        </div>
        <Card>
          <CardContent className="p-0 divide-y">
            {users.map((u) => (
              <div key={u.email} className="flex items-center gap-3 p-4">
                <Avatar><AvatarFallback className="bg-primary/10 text-primary text-xs">{u.initials}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{u.email}</p>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1"><Shield className="h-3 w-3" />{u.role}</Badge>
                <Badge variant={u.status === "Activo" ? "default" : "secondary"}>{u.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}