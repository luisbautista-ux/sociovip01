'use client';

import { useEffect, useMemo, useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Contact, Crown, Download, Search } from "lucide-react";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

/* ===================== Helpers de fecha (aceptan Timestamp/Date/string/number) ===================== */
function anyToDate(value: any): Date | null {
  if (!value) return null;

  // Date nativa
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  // Firestore: objetos con toDate()
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return isNaN(d.getTime()) ? null : d;
  }

  // Firestore: objetos { seconds, nanoseconds }
  if (typeof value?.seconds === "number") {
    const ms = value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1e6);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // Número: milisegundos epoch
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // String
  if (typeof value === "string") {
    // Soporte a dd/MM/yyyy o dd-MM-yyyy (con o sin hora)
    const m = value.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (m) {
      const norm = value.replace(/-/g, "/");
      const hasTime = !!m[4];
      const pattern = hasTime ? "dd/MM/yyyy HH:mm:ss" : "dd/MM/yyyy";
      const candidate = hasTime && norm.length === 16 ? `${norm}:00` : norm; // completa :ss si falta
      const d = parse(candidate, pattern, new Date());
      return isNaN(d.getTime()) ? null : d;
    }

    // ISO u otros formatos que Date pueda entender
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function renderDate(value: any, fmt = "P p") {
  const d = anyToDate(value);
  return d ? format(d, fmt, { locale: es }) : "N/A";
}

// Evita warnings de hidratación en Next (fecha se calcula 100% en el cliente)
const ClientSideFormattedDateTime = ({ value, fmt = "P p" }: { value: any; fmt?: string }) => {
  const [text, setText] = useState<string>("...");
  useEffect(() => { setText(renderDate(value, fmt)); }, [value, fmt]);
  return <>{text}</>;
};

/* ===================== Tipos mínimos locales ===================== */
type BusinessClientType = "qr" | "vip";

type QrClient = {
  id: string;
  name: string;
  surname: string;
  phone?: string | number;
  dni: string;
  registrationDate: any; // Timestamp/Date/string/number
  generatedForBusinessId: string;
};

type SocioVipMember = {
  id: string;
  name: string;
  surname: string;
  email?: string;
  phone?: string | number;
  dni: string;
  joinDate: any; // Timestamp/Date/string/number
  loyaltyPoints?: number;
  membershipStatus?: "active" | "inactive" | "pending_payment" | "cancelled";
  businessId?: string; // Es opcional y puede no estar
};

type BusinessClientView = {
  id: string;
  clientType: BusinessClientType;
  name: string;
  surname: string;
  dni: string;
  phone?: string | number;
  email?: string;
  relevantDate: any;
  isVip: boolean;
  loyaltyPoints?: number;
  membershipStatus?: SocioVipMember["membershipStatus"];
};

const membershipStatusTranslations: Record<
  NonNullable<SocioVipMember["membershipStatus"]>,
  string
> = {
  active: "Activa",
  inactive: "Inactiva",
  pending_payment: "Pendiente Pago",
  cancelled: "Cancelada",
};

export default function AdminQrClientsPage() {
  const { userProfile } = useAuth(); // debe proveer roles[] y businessId
  const { toast } = useToast();

  const [qrClients, setQrClients] = useState<QrClient[]>([]);
  const [vipMembers, setVipMembers] = useState<SocioVipMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<BusinessClientType | "all">("all");

  const isSuperAdmin = !!userProfile?.roles?.includes?.("superadmin");

  useEffect(() => {
    const load = async () => {
      if (!userProfile) return;
      if (!isSuperAdmin && !userProfile.businessId) return;

      setLoading(true);
      try {
        const fetchQrClients = async () => {
          const qrRef = collection(db, "qrClients");
          const qrQuery = userProfile.businessId
            ? query(qrRef, where("generatedForBusinessId", "==", userProfile.businessId))
            : qrRef; // Superadmin gets all
          const qrSnap = await getDocs(qrQuery);
          return qrSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as QrClient[];
        };
        
        // Only superadmin can see VIP members for now to avoid permission errors
        // since VIP members don't have businessId
        const fetchVipMembers = async () => {
          if (!isSuperAdmin) return [];

          const vipRef = collection(db, "socioVipMembers");
          const vipSnap = await getDocs(vipRef);
          return vipSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as SocioVipMember[];
        };
        
        const [qrData, vipData] = await Promise.all([
          fetchQrClients(),
          fetchVipMembers()
        ]);

        setQrClients(qrData);
        setVipMembers(vipData);

      } catch (e: any) {
        console.error("Error cargando clientes:", e?.code, e?.message);
        toast({
          title: "Error al cargar clientes",
          description: e?.message ?? "No se pudieron obtener los datos. Revisa las reglas de seguridad.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userProfile, isSuperAdmin, toast]);

  const combinedClients = useMemo<BusinessClientView[]>(() => {
    const qrViews: BusinessClientView[] = qrClients.map((qc) => ({
      id: qc.id,
      clientType: "qr",
      name: qc.name ?? "",
      surname: qc.surname ?? "",
      dni: qc.dni ?? "",
      phone: qc.phone,
      email: undefined,
      relevantDate: qc.registrationDate,
      isVip: false,
    }));

    const vipViews: BusinessClientView[] = vipMembers.map((svm) => ({
      id: svm.id,
      clientType: "vip",
      name: svm.name ?? "",
      surname: svm.surname ?? "",
      dni: svm.dni ?? "",
      phone: svm.phone,
      email: svm.email,
      relevantDate: svm.joinDate,
      isVip: true,
      loyaltyPoints: svm.loyaltyPoints,
      membershipStatus: svm.membershipStatus,
    }));

    return [...qrViews, ...vipViews].sort((a, b) => {
      const ta = anyToDate(a.relevantDate)?.getTime() ?? 0;
      const tb = anyToDate(b.relevantDate)?.getTime() ?? 0;
      return tb - ta; // descendente
    });
  }, [qrClients, vipMembers]);

  const filteredClients = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return combinedClients.filter((c) => {
      const typeMatch = filterType === "all" || c.clientType === filterType;
      const nameMatch = `${c.name} ${c.surname}`.toLowerCase().includes(searchLower);
      const dniMatch = (c.dni ?? "").toLowerCase().includes(searchLower);
      const emailMatch = (c.email ?? "").toLowerCase().includes(searchLower);
      const phoneMatch = String(c.phone ?? "").includes(searchTerm);
      return typeMatch && (nameMatch || dniMatch || emailMatch || phoneMatch);
    });
  }, [searchTerm, filterType, combinedClients]);

  const handleExportCsv = () => {
    if (filteredClients.length === 0) {
      toast({
        title: "Sin Datos",
        description: "No hay clientes para exportar con los filtros actuales.",
        variant: "destructive",
      });
      return;
    }

    const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`; // escape seguro para CSV

    const headers = [
      "ID",
      "Tipo Cliente",
      "Nombres",
      "Apellidos",
      "DNI/CE",
      "Teléfono",
      "Email",
      "Fecha Registro/Ingreso",
      "Puntos (VIP)",
      "Estado Membresía (VIP)",
    ];

    const rows = filteredClients.map((c) => [
      c.id,
      c.clientType === "qr" ? "Cliente QR" : "Socio VIP",
      c.name,
      c.surname,
      c.dni,
      c.phone || "N/A",
      c.email || "N/A",
      renderDate(c.relevantDate, "P p"),
      c.isVip ? String(c.loyaltyPoints ?? 0) : "N/A",
      c.isVip && c.membershipStatus ? membershipStatusTranslations[c.membershipStatus] : "N/A",
    ].map(q));

    const csv =
      "data:text/csv;charset=utf-8," +
      headers.map(q).join(",") +
      "\n" +
      rows.map((r) => r.join(",")).join("\n");

    const encoded = encodeURI(csv);
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute(
      "download",
      `clientes_${isSuperAdmin ? "todos_negocios" : userProfile?.businessId ?? "negocio"}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Exportación Exitosa", description: `${filteredClients.length} clientes exportados.` });
  };

  if (loading) return <p>Cargando clientes…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Contact className="h-8 w-8 mr-2" /> Mis Clientes
        </h1>
        <Button onClick={handleExportCsv} variant="outline">
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Listado de Clientes</CardTitle>
          <CardDescription>
            {isSuperAdmin ? "Visualizando clientes de todos los negocios." : "Visualizando clientes de tu negocio asignado."}
          </CardDescription>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por nombre, DNI, email, teléfono..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              value={filterType}
              onValueChange={(v) => setFilterType(v as BusinessClientType | "all")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="qr">Clientes QR</SelectItem>
                {isSuperAdmin && <SelectItem value="vip">Socios VIP</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre Completo</TableHead>
                <TableHead className="hidden md:table-cell">DNI/CE</TableHead>
                <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                <TableHead className="hidden xl:table-cell">Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fecha Reg./Ingreso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.length > 0 ? (
                filteredClients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.name} {c.surname}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{c.dni}</TableCell>
                    <TableCell className="hidden lg:table-cell">{c.phone || "N/A"}</TableCell>
                    <TableCell className="hidden xl:table-cell">{c.email || "N/A"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={c.isVip ? "default" : "secondary"}
                        className={c.isVip ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""}
                      >
                        {c.isVip && <Crown className="mr-1 h-3.5 w-3.5" />}
                        {c.clientType === "qr" ? "Cliente QR" : "Socio VIP"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ClientSideFormattedDateTime value={c.relevantDate} fmt="P p" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    No se encontraron clientes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
