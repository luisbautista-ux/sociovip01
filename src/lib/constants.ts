
// src/lib/constants.ts
import type { GeneratedCode, SocioVipMember, PlatformUserRole } from "./types";

export const GENERATED_CODE_STATUS_TRANSLATIONS: Record<GeneratedCode['status'], string> = {
  available: "Disponible",
  redeemed: "Canjeado/Utilizado",
  expired: "Vencido",
};

export const GENERATED_CODE_STATUS_COLORS: Record<GeneratedCode['status'], "default" | "secondary" | "destructive" | "outline"> = {
    available: "default", 
    redeemed: "secondary",
    expired: "destructive",
};

export const MEMBERSHIP_STATUS_TRANSLATIONS: Record<SocioVipMember['membershipStatus'], string> = {
  active: "Activa",
  inactive: "Inactiva",
  pending_payment: "Pendiente Pago",
  cancelled: "Cancelada",
};

export const MEMBERSHIP_STATUS_COLORS: Record<SocioVipMember['membershipStatus'], "default" | "secondary" | "destructive" | "outline"> = {
    active: "default", 
    inactive: "secondary",
    pending_payment: "outline", 
    cancelled: "destructive",
};

export const MESES_DEL_ANO_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export const ALL_PLATFORM_USER_ROLES: PlatformUserRole[] = ['superadmin', 'business_admin', 'staff', 'promoter', 'host'];

export const PLATFORM_USER_ROLE_TRANSLATIONS: Record<PlatformUserRole, string> = {
  superadmin: "Super Admin",
  business_admin: "Admin Negocio",
  staff: "Staff Negocio",
  promoter: "Promotor",
  host: "Anfitrión",
};

export const ROLES_REQUIRING_BUSINESS_ID: PlatformUserRole[] = ['business_admin', 'staff', 'host'];
