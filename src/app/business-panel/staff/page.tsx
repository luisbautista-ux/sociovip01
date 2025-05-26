
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, PlusCircle } from "lucide-react";
import type { PlatformUser } from "@/lib/types";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Mock Staff data for this business (these would be PlatformUser with role 'business_staff')
const mockStaff: PlatformUser[] = [
    { id: "staff1", name: "Ana Torres", email: "ana.torres@negocio.com", role: "business_staff", businessId: "biz1", lastLogin: "2024-07-22T10:00:00Z" },
    { id: "staff2", name: "Luis Vera", email: "luis.vera@negocio.com", role: "business_staff", businessId: "biz1", lastLogin: "2024-07-21T14:30:00Z" },
];


export default function BusinessStaffPage() {
  const [staffMembers, setStaffMembers] = useState<PlatformUser[]>(mockStaff);
  // Add state for modals, forms, etc. later

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Users className="h-8 w-8 mr-2" /> Gestión de Personal
        </h1>
        <Button className="bg-primary hover:bg-primary/90">
          <PlusCircle className="mr-2 h-4 w-4" /> Añadir Personal
        </Button>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Mi Personal</CardTitle>
          <CardDescription>Administra los usuarios staff de tu negocio.</CardDescription>
        </CardHeader>
        <CardContent>
           {staffMembers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Último Acceso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffMembers.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">{staff.name}</TableCell>
                    <TableCell>{staff.email}</TableCell>
                    <TableCell><Badge variant="outline">{staff.role === "business_staff" ? "Staff Negocio" : staff.role}</Badge></TableCell>
                    <TableCell>{format(new Date(staff.lastLogin), "P p", { locale: es })}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" disabled> {/* Placeholder */}
                        <Users className="h-4 w-4" /> {/* Placeholder icon for edit/permissions */}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No hay personal registrado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
