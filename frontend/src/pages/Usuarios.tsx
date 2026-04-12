import { useState } from "react";
import { Users, UserPlus, Shield, Mail, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";
import { createOperationsUser } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function UsuariosPage() {
  const { data, isLoading, isError } = useOperationsOverview();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const users = data?.users ?? [];

  const onCreateUser = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Debes ingresar nombre y email");
      return;
    }

    try {
      setCreating(true);
      const user = await createOperationsUser({
        full_name: name,
        email,
        role: "USER",
        status: "ACTIVE",
        email_verified: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
      toast.success(
        user.temporary_password
          ? `Usuario creado. Contraseña temporal: ${user.temporary_password}`
          : "Usuario creado exitosamente"
      );
      setName("");
      setEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el usuario");
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Usuarios</h2>
            <p className="text-sm text-muted-foreground">Gestión de usuarios y permisos</p>
          </div>
          <Badge variant="secondary" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {users.length} usuarios
          </Badge>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando usuarios...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar usuarios.</Card>}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agregar Usuario</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre completo" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@empresa.com" />
            </div>
            <Button onClick={onCreateUser} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Agregar Usuario
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 divide-y">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-3 p-4">
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">{user.initials || "U"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{user.name ?? "Sin nombre"}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {user.email}
                  </p>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {user.role}
                </Badge>
                <Badge variant={user.status === "Activo" ? "default" : "secondary"}>{user.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
