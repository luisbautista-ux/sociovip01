
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Star, PlusCircle, Download, Search, Edit, Trash2, Mail, Phone, Award, ShieldCheck, CalendarDays, Cake, Filter } from "lucide-react";
import type { SocioVipMember, SocioVipMemberFormData } from "@/lib/types";
import { format, getMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SocioVipMemberForm } from "@/components/admin/forms/SocioVipMemberForm";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MEMBERSHIP_STATUS_TRANSLATIONS, MEMBERSHIP_STATUS_COLORS, MESES_DEL_ANO_ES } from "@/lib/constants";

// Mock Data - make it mutable for updates
let mockSocioVipMembers: SocioVipMember[] = [
  { id: "vip1", name: "Elena", surname: "Rodriguez", email: "elena.vip@example.com", phone: "+51999888777", dob: "1988-03-12T12:00:00", dni: "26789012", loyaltyPoints: 1500, membershipStatus: "active", joinDate: "2023-01-20T00:00:00Z", address: "Av. El Sol 456, Cusco", profession: "Arquitecta", preferences: ["Viajes", "Fotografía", "Comida Gourmet"], staticQrCodeUrl: "https://placehold.co/100x100.png?text=ELENAQR" },
  { id: "vip2", name: "Roberto", surname: "Chavez", email: "roberto.vip@example.com", phone: "+51911222333", dob: "1975-09-05T12:00:00", dni: "09876543", loyaltyPoints: 850, membershipStatus: "inactive", joinDate: "2022-11-10T00:00:00Z", address: "Calle Luna 123, Arequipa", profession: "Empresario", preferences: ["Vinos", "Golf"], staticQrCodeUrl: "https://placehold.co/100x100.png?text=ROBERTOQR"  },
  { id: "vip3", name: "Isabel", surname: "Flores", email: "isabel.vip@example.com", phone: "+51955666777", dob: "1992-07-22T12:00:00", dni: "34567890", loyaltyPoints: 2200, membershipStatus: "pending_payment", joinDate: "2025-06-01T12:00:00Z", preferences: ["Yoga", "Lectura"] },
  { id: "vip4", name: "Luis", surname: "Gomez", email: "luis.vip@example.com", phone: "+51922333444", dob: "1990-03-25T12:00:00", dni: "45678901", loyaltyPoints: 500, membershipStatus: "active", joinDate: "2025-03-15T12:00:00Z", address: "Jr. Los Pinos 789, Lima", profession: "Doctor", preferences: ["Deportes", "Tecnología"], staticQrCodeUrl: "https://placehold.co/100x100.png?text=LUISQR"  },
];

export default function AdminSocioVipPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [birthdayMonthFilter, setBirthdayMonthFilter] = useState<string>("all");
  const [joinMonthFilter, setJoinMonthFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMember, setEditingMember] = useState<SocioVipMember | null>(null);
  const [members, setMembers] = useState<SocioVipMember[]>(mockSocioVipMembers);
  const { toast } = useToast();

  const filteredMembers = members.filter(member => {
    const searchMatch = (
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.dni.includes(searchTerm)
    );

    const birthdayMatch = birthdayMonthFilter === "all" ||
      (member.dob && getMonth(new Date(member.dob)) === parseInt(birthdayMonthFilter));

    const joinMatch = joinMonthFilter === "all" ||
      (member.joinDate && getMonth(new Date(member.joinDate)) === parseInt(joinMonthFilter));

    return searchMatch && birthdayMatch && joinMatch;
  });

  const handleExport = () => {
    const headers = ["ID", "Nombre", "Apellido", "Email", "Teléfono", "DNI", "Fec. Nac.", "Puntos", "Estado Membresía", "Fecha Ingreso", "Dirección", "Profesión", "Preferencias"];
    const rows = filteredMembers.map(mem => [
      mem.id, mem.name, mem.surname, mem.email, mem.phone, mem.dni,
      mem.dob ? format(new Date(mem.dob), "dd/MM/yyyy", { locale: es }) : "N/A",
      mem.loyaltyPoints, MEMBERSHIP_STATUS_TRANSLATIONS[mem.membershipStatus],
      mem.joinDate ? format(new Date(mem.joinDate), "dd/MM/yyyy", { locale: es }) : "N/A",
      mem.address || "N/A", mem.profession || "N/A", mem.preferences?.join(', ') || "N/A"
    ]);
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sociovip_socios_vip.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exportación Exitosa", description: "Archivo CSV generado."});
  };

  const handleCreateMember = (data: SocioVipMemberFormData) => {
    const newMember: SocioVipMember = {
      id: `vip${Date.now()}`,
      name: data.name,
      surname: data.surname,
      dni: data.dni,
      phone: data.phone,
      dob: format(data.dob, "yyyy-MM-dd'T'HH:mm:ss"),
      email: data.email,
      address: data.address,
      profession: data.profession,
      preferences: data.preferences?.split(',').map(p => p.trim()).filter(p => p) || [],
      loyaltyPoints: data.loyaltyPoints,
      membershipStatus: data.membershipStatus,
      joinDate: new Date().toISOString(),
      staticQrCodeUrl: `https://placehold.co/100x100.png?text=${data.name.substring(0,3).toUpperCase()}QR`
    };
    setMembers(prev => [newMember, ...prev]);
    setShowCreateModal(false);
    toast({ title: "Socio VIP Creado", description: `El socio "${newMember.name} ${newMember.surname}" ha sido creado.` });
  };

  const handleEditMember = (data: SocioVipMemberFormData) => {
    if (!editingMember) return;
    const updatedMember: SocioVipMember = {
      ...editingMember,
      name: data.name,
      surname: data.surname,
      dni: data.dni,
      phone: data.phone,
      dob: format(data.dob, "yyyy-MM-dd'T'HH:mm:ss"),
      email: data.email,
      address: data.address,
      profession: data.profession,
      preferences: data.preferences?.split(',').map(p => p.trim()).filter(p => p) || [],
      loyaltyPoints: data.loyaltyPoints,
      membershipStatus: data.membershipStatus,
    };
    setMembers(prev => prev.map(m => m.id === editingMember.id ? updatedMember : m));
    setEditingMember(null);
    toast({ title: "Socio VIP Actualizado", description: `El socio "${updatedMember.name} ${updatedMember.surname}" ha sido actualizado.` });
  };
  
  const handleDeleteMember = (memberId: string) => {
    setMembers(prev => prev.filter(m => m.id !== memberId));
    toast({ title: "Socio VIP Eliminado", description: `El socio ha sido eliminado.`, variant: "destructive" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Star className="h-8 w-8 mr-2" /> Gestión de Socios VIP
        </h1>
        <div className="flex space-x-2">
          <Button onClick={handleExport} variant="outline">
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="bg-primary hover:bg-primary/90">
            <PlusCircle className="mr-2 h-4 w-4" /> Crear Socio VIP
          </Button>
        </div>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Lista de Socios VIP</CardTitle>
          <CardDescription>Miembros exclusivos de la plataforma SocioVIP.</CardDescription>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 items-end">
            <div className="relative">
              <Label htmlFor="search-members">Buscar Socio</Label>
              <Search className="absolute left-2.5 top-[calc(1.75rem+0.625rem)] h-4 w-4 text-muted-foreground" />
              <Input
                id="search-members"
                type="search"
                placeholder="Buscar por nombre, email, DNI..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="birthday-month-filter">Filtrar por Mes de Cumpleaños</Label>
              <Select value={birthdayMonthFilter} onValueChange={setBirthdayMonthFilter}>
                <SelectTrigger id="birthday-month-filter">
                  <SelectValue placeholder="Todos los meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {MESES_DEL_ANO_ES.map((mes, index) => (
                    <SelectItem key={index} value={index.toString()}>{mes}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="join-month-filter">Filtrar por Mes de Registro</Label>
              <Select value={joinMonthFilter} onValueChange={setJoinMonthFilter}>
                <SelectTrigger id="join-month-filter">
                  <SelectValue placeholder="Todos los meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {MESES_DEL_ANO_ES.map((mes, index) => (
                    <SelectItem key={index} value={index.toString()}>{mes}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre Completo</TableHead>
                <TableHead className="hidden lg:table-cell"><Mail className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>Email</TableHead>
                <TableHead className="hidden md:table-cell"><Phone className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>Teléfono</TableHead>
                <TableHead className="hidden xl:table-cell">DNI</TableHead>
                <TableHead><Cake className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>Fec. Nac.</TableHead>
                <TableHead className="text-center"><Award className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>Puntos</TableHead>
                <TableHead><ShieldCheck className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>Estado Membresía</TableHead>
                <TableHead className="hidden lg:table-cell"><CalendarDays className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>Fecha Ingreso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.length > 0 ? (
                filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name} {member.surname}</TableCell>
                    <TableCell className="hidden lg:table-cell">{member.email}</TableCell>
                    <TableCell className="hidden md:table-cell">{member.phone}</TableCell>
                    <TableCell className="hidden xl:table-cell">{member.dni}</TableCell>
                    <TableCell>{member.dob ? format(new Date(member.dob), "P", { locale: es }) : "N/A"}</TableCell>
                    <TableCell className="text-center">{member.loyaltyPoints}</TableCell>
                    <TableCell>
                      <Badge variant={MEMBERSHIP_STATUS_COLORS[member.membershipStatus]}>
                        {MEMBERSHIP_STATUS_TRANSLATIONS[member.membershipStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{member.joinDate ? format(new Date(member.joinDate), "P", { locale: es }) : "N/A"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingMember(member)}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </Button>
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Eliminar</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Esto eliminará permanentemente al socio
                               <span className="font-semibold"> {member.name} {member.surname}</span>.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteMember(member.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                 <TableRow>
                  <TableCell colSpan={9} className="text-center h-24">No se encontraron socios VIP con los filtros aplicados.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Socio VIP</DialogTitle>
            <DialogDescription>Completa los detalles para registrar un nuevo Socio VIP.</DialogDescription>
          </DialogHeader>
          <SocioVipMemberForm
            onSubmit={handleCreateMember} 
            onCancel={() => setShowCreateModal(false)} 
          />
        </DialogContent>
      </Dialog>

      {editingMember && (
         <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Socio VIP: {editingMember.name} {editingMember.surname}</DialogTitle>
               <DialogDescription>Actualiza los detalles del Socio VIP.</DialogDescription>
            </DialogHeader>
            <SocioVipMemberForm
              member={editingMember} 
              onSubmit={handleEditMember} 
              onCancel={() => setEditingMember(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
