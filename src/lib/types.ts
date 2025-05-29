
// src/lib/types.ts
import type { Timestamp } from "firebase/firestore";
import type { BUSINESS_TYPES } from "./constants"; 

export interface PromotionDetails { 
  id: string;
  title: string;
  description: string;
  validUntil: string; 
  imageUrl: string;
  promoCode: string;
  aiHint: string;
  type: 'promotion' | 'event';
  termsAndConditions?: string;
}

export type QrCodeStatusGenerated = 'available' | 'redeemed' | 'expired';

export interface QrClient {
  id: string; 
  dni: string;
  name: string;
  surname: string;
  phone: string;
  dob: Timestamp | string; 
  registrationDate: Timestamp | string; 
}

export interface QrCodeData {
  user: QrClient;
  promotion: PromotionDetails; // Podría ser también EventDetails si se generaliza
  code: string; // El contenido del QR (ej. el código de la promoción o un identificador único)
  status: QrCodeStatusGenerated; // El estado del código de 9 dígitos, si aplica
}

export type BusinessType = typeof BUSINESS_TYPES[number];


export interface Business {
  id: string; 
  name: string; 
  contactEmail: string;
  joinDate: Timestamp | string; 
  activePromotions: number; 
  ruc?: string;
  razonSocial?: string; 
  department?: string;
  province?: string;
  district?: string;
  address?: string;
  managerName?: string;
  managerDni?: string;
  businessType?: BusinessType;
  // Campos públicos
  logoUrl?: string;
  publicCoverImageUrl?: string;
  slogan?: string;
  publicContactEmail?: string;
  publicPhone?: string;
  publicAddress?: string;
  customUrlPath?: string; 
}

export type PlatformUserRole = 'superadmin' | 'business_admin' | 'staff' | 'promoter' | 'host';

export interface PlatformUser {
  id: string; 
  uid: string; 
  dni: string;
  name: string;
  email: string;
  roles: PlatformUserRole[];
  businessId?: string | null;
  lastLogin: Timestamp | string; 
}

export interface SocioVipMember {
  id: string; 
  dni: string;
  name: string;
  surname: string;
  phone: string;
  dob: Timestamp | string; 
  email: string;
  address?: string;
  profession?: string;
  preferences?: string[];
  loyaltyPoints: number;
  membershipStatus: 'active' | 'inactive' | 'pending_payment' | 'cancelled';
  staticQrCodeUrl?: string;
  joinDate: Timestamp | string; 
  authUid?: string; 
}


export interface AdminDashboardStats {
  totalBusinesses: number;
  totalPlatformUsers: number;
  totalPromotionsActive: number;
  totalQrCodesGenerated: number;
  totalQrClients: number;
  totalSocioVipMembers: number;
}

export interface PromotionAnalyticsData { // Se usa para el gráfico del admin y podría usarse para el negocio
  month: string; // ej. "Ene 25"
  promotionsCreated: number; // O entidades creadas
  qrCodesGenerated: number; // O códigos de 9 dígitos creados para esas entidades
  qrCodesUtilized: number; // O códigos de 9 dígitos canjeados
}

export interface RegisteredClient { 
  date: string; // "dd MMM"
  newRegistrations: number;
}

export type BusinessEntityType = 'promotion' | 'event' | 'survey';

export interface GeneratedCode {
  id: string; 
  value: string;
  entityId: string;
  status: QrCodeStatusGenerated;
  generatedByName: string;
  generatedDate: string; 
  redemptionDate?: string | null; 
  redeemedByInfo?: {
    dni: string;
    name: string;
    phone?: string;
  } | null;
  observation?: string | null;
  isVipCandidate?: boolean;
}

export interface CommissionRule {
  id: string;
  appliesTo: 'event_general' | 'promotion_general' | 'ticket_type' | 'box_type';
  appliesToId?: string; 
  appliesToName?: string;
  commissionType: 'fixed' | 'percentage';
  commissionValue: number;
  description?: string;
}
export interface EventPromoterAssignment {
  promoterProfileId: string; 
  promoterName: string; 
  promoterEmail?: string;
  commissionRules?: CommissionRule[];
  notes?: string;
}

export interface TicketType {
  id: string;
  eventId: string; 
  businessId: string;
  name: string;
  cost: number;
  description?: string;
  quantity?: number; // Si es undefined o 0, se considera ilimitado para el cálculo de aforo.
}

export interface EventBox {
  id: string;
  eventId: string; 
  businessId: string;
  name: string;
  cost: number;
  description?: string;
  status: 'available' | 'unavailable';
  capacity?: number;
  sellerName?: string;
  ownerName?: string;
  ownerDni?: string;
}

export interface BusinessManagedEntity {
  id: string; 
  businessId: string;
  type: BusinessEntityType;
  name: string;
  description: string;
  startDate: string; 
  endDate: string; 
  usageLimit?: number; // Para promociones: límite de canjes.
  maxAttendance?: number; // Para eventos: calculado de tickets o fijo.
  isActive: boolean;
  imageUrl?: string;
  aiHint?: string;
  termsAndConditions?: string;
  generatedCodes?: GeneratedCode[];
  // Event specific
  ticketTypes?: TicketType[];
  eventBoxes?: EventBox[];
  assignedPromoters?: EventPromoterAssignment[];
  // Para UI
  businessName?: string; 
  businessLogoUrl?: string;
  businessCustomUrlPath?: string;
  createdAt?: string;
}

export interface PromoterProfile { // Perfil global de un promotor
  id: string; 
  name: string;
  email: string;
  phone?: string;
  dni?: string;
  // Otros campos relevantes para el perfil global
}

export interface BusinessPromoterLink { // Vínculo entre un negocio y un promotor global
  id: string; 
  businessId: string;
  promoterDni: string; // DNI del promotor
  promoterName: string; 
  promoterEmail: string; 
  promoterPhone?: string;
  commissionRate?: string; // Tasa general, puede ser anulada por reglas específicas en EventPromoterAssignment
  isActive: boolean;
  isPlatformUser: boolean; // True si el promotor tiene una cuenta en PlatformUsers con rol 'promoter'
  platformUserUid?: string; // UID de Firebase Auth si isPlatformUser es true
  joinDate: Timestamp | string; 
}


export type BusinessClientType = 'qr' | 'vip';

export interface BusinessClientView {
  id: string;
  clientType: BusinessClientType;
  name: string;
  surname: string;
  dni: string;
  phone?: string;
  email?: string;
  relevantDate: string; 
  isVip: boolean;
  loyaltyPoints?: number;
  membershipStatus?: SocioVipMember['membershipStatus'];
}


// Form data types
export interface BusinessFormData {
  name: string;
  contactEmail: string;
  ruc?: string;
  razonSocial?: string;
  department?: string;
  province?: string;
  district?: string;
  address?: string;
  managerName?: string;
  managerDni?: string;
  businessType?: BusinessType;
  // Campos públicos
  logoUrl?: string;
  publicCoverImageUrl?: string;
  slogan?: string;
  publicContactEmail?: string;
  publicPhone?: string;
  publicAddress?: string;
  customUrlPath?: string;
}

export interface PlatformUserFormData {
  uid?: string; // Obligatorio al crear, no editable
  dni: string;
  name: string;
  email: string;
  roles: PlatformUserRole[];
  businessId?: string | null;
}

export interface SocioVipMemberFormData {
  dni: string;
  name: string;
  surname: string;
  phone: string;
  dob: Date; 
  email: string;
  address?: string;
  profession?: string;
  preferences?: string;
  loyaltyPoints: number;
  membershipStatus: SocioVipMember['membershipStatus'];
}

export interface NewQrClientFormData { // Para el modal de registro de cliente QR
  dni: string;
  name: string;
  surname: string;
  phone: string;
  dob: Date;
}

export interface BusinessPromotionFormData {
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  usageLimit?: number;
  isActive: boolean;
  imageUrl?: string;
  aiHint?: string;
  termsAndConditions?: string;
}

export interface BusinessEventFormData {
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  // maxAttendance ya no es un campo de entrada directa, se calcula
  isActive: boolean;
  imageUrl?: string;
  aiHint?: string;
  termsAndConditions?: string;
}

export interface BusinessPromoterFormData { // Para el formulario de vincular/editar promotor al negocio
  promoterDni: string; // No editable después de la verificación inicial
  promoterName: string;
  promoterEmail: string;
  promoterPhone?: string;
  commissionRate?: string; // Comisión general para este negocio
}

export interface PromoterCommissionEntry { // Para la tabla de comisiones del promotor
    id: string;
    businessName: string;
    entityName: string;
    entityType: 'promotion' | 'event';
    codesRedeemedByPromoter: number; // Códigos canjeados que generó este promotor
    commissionRate: string; // Descripción de la tasa (ej. "S/ 0.50 por código" o "5%")
    commissionEarned: number;
    paymentStatus: 'Pendiente' | 'Pagado';
    period: string; // Ej. "Julio 2024"
}

export interface TicketTypeFormData {
  name: string;
  cost: number;
  description?: string;
  quantity?: number; // Si es undefined o 0, es ilimitado para cálculo de aforo
}

export interface EventBoxFormData {
  name: string;
  cost: number;
  description?: string;
  status: 'available' | 'unavailable';
  capacity?: number;
  sellerName?: string;
  ownerName?: string;
  ownerDni?: string;
}

export interface BatchBoxFormData {
  prefix: string;
  fromNumber: number;
  toNumber: number;
  cost: number;
  capacity?: number;
  description?: string;
  status: 'available' | 'unavailable';
}


export interface InitialDataForPlatformUserCreation {
  dni: string;
  name?: string;
  email?: string;
  existingUserIsPlatformUser?: boolean; 
  existingPlatformUser?: PlatformUser; 
  existingPlatformUserRoles?: PlatformUserRole[]; 
  preExistingUserType?: 'QrClient' | 'SocioVipMember'; 
}

export interface InitialDataForSocioVipCreation {
  dni: string;
  name?: string;
  surname?: string;
  phone?: string;
  dob?: string; 
  email?: string;
  existingUserType?: 'QrClient' | 'PlatformUser';
  // No necesitamos existingSocioVipProfile aquí porque si ya es Socio, el flujo lo lleva a editar.
}

export interface InitialDataForPromoterLink {
  dni: string;
  existingLink?: BusinessPromoterLink; // Si el DNI ya está vinculado a este negocio
  existingPlatformUserPromoter?: PlatformUser; // Si el DNI es un PlatformUser con rol 'promoter'
  qrClientData?: QrClient; // Si el DNI es un QrClient (para pre-rellenar)
  socioVipData?: SocioVipMember; // Si el DNI es un SocioVipMember (para pre-rellenar)
}
