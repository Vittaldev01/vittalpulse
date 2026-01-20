import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, Package } from "lucide-react";
import { EmpresaStatsCards } from "@/components/empresas/EmpresaStatsCards";
import { EmpresasTab } from "@/components/empresas/EmpresasTab";
import { UsersTab } from "@/components/empresas/UsersTab";
import { PlanosTab } from "@/components/empresas/PlanosTab";

export default function Empresas() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Painel Super Admin</h1>
        <p className="text-muted-foreground">Gerencie empresas, usuários e planos do sistema</p>
      </div>

      {/* Stats Cards */}
      <EmpresaStatsCards />

      {/* Tabs */}
      <Tabs defaultValue="empresas" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="empresas" className="gap-2">
            <Building2 className="h-4 w-4" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="planos" className="gap-2">
            <Package className="h-4 w-4" />
            Planos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="empresas">
          <EmpresasTab />
        </TabsContent>

        <TabsContent value="usuarios">
          <UsersTab />
        </TabsContent>

        <TabsContent value="planos">
          <PlanosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
