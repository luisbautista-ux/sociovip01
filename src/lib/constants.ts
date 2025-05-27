
// src/lib/constants.ts
import type { GeneratedCode, SocioVipMember } from "./types";

export const GENERATED_CODE_STATUS_TRANSLATIONS: Record<GeneratedCode['status'], string> = {
  available: "Disponible",
  redeemed: "Canjeado/Utilizado",
  expired: "Vencido",
};

export const GENERATED_CODE_STATUS_COLORS: Record<GeneratedCode['status'], "default" | "secondary" | "destructive" | "outline"> = {
    available: "default", // Or "success" if you have a success variant
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
    active: "default", // Or "success"
    inactive: "secondary",
    pending_payment: "outline", // Or "warning"
    cancelled: "destructive",
};

export const MESES_DEL_ANO_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
