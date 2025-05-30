
// src/lib/types.ts
import type { Timestamp } from "firebase/firestore";
import type { BUSINESS_TYPES } from "./constants"; 

export interface PromotionDetails { 
  id: string;
  title: string;
  description: string;
  validUntil: string; 
  imageUrl: string;
  promoCode: string; // El código general de la campaña/promoción (ej. MARTES2X1)
  aiHint: string;
  type: 'promotion' | 'event'; // Para diferenciar en la UI pública
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

export interface QrCodeData { // Para la data que se muestra con el QR al cliente final
  user: QrClient;
  promotion: PromotionDetails; // La promoción/evento a la que aplica
  code: string; // El código que se codifica en el QR (puede ser el promoCode general o un GeneratedCode.value único)
  status: QrCodeStatusGenerated; // Estado del código de 9 dígitos si este es el que se codifica
}

export type BusinessType = typeof BUSINESS_TYPES[number];


export interface Business {
  id: string; 
  name: string; 
  contactEmail: string;
  joinDate: Timestamp | string; 
  // activePromotions: number; // Este campo puede ser calculado dinámicamente
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
  id: string; // ID del documento en Firestore (puede ser igual al uid)
  uid: string; // UID de Firebase Authentication
  dni: string;
  name: string;
  email: string;
  roles: PlatformUserRole[];
  businessId?: string | null; // ID del negocio al que pertenece (si aplica)
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
  staticQrCodeUrl?: string; // URL a un QR estático para su membresía VIP
  joinDate: Timestamp | string; 
  authUid?: string; // UID de Firebase Auth si tiene cuenta en la plataforma
}


export interface AdminDashboardStats {
  totalBusinesses: number;
  totalPlatformUsers: number;
  totalPromotionsActive: number;
  totalQrCodesGenerated: number; // Total de códigos de 9 dígitos generados
  totalQrClients: number;       // Total de clientes QR únicos registrados
  totalSocioVipMembers: number;
}

export interface PromotionAnalyticsData { 
  month: string;
  promotionsCreated: number; 
  qrCodesGenerated: number; 
  qrCodesUtilized: number; 
}

export interface RegisteredClient { // Este tipo se usó para el dashboard, podría ser QrClient
  date: string; 
  newRegistrations: number;
}

export type BusinessEntityType = 'promotion' | 'event' | 'survey';

export interface GeneratedCode { // Código único de 9 dígitos
  id: string; 
  entityId: string; // ID de la BusinessManagedEntity a la que pertenece
  value: string; // El código alfanumérico de 9 dígitos
  status: QrCodeStatusGenerated;
  generatedByName: string; // Nombre del usuario (negocio/staff/promotor) que lo generó
  generatedDate: string; // ISO string
  redemptionDate?: string | null; // ISO string
  redeemedByInfo?: {
    dni: string;
    name: string;
    phone?: string;
  } | null;
  observation?: string | null;
  isVipCandidate?: boolean;
}

export type CommissionRuleType = 'fixed' | 'percentage';
export type CommissionRuleTarget = 'event_general' | 'promotion_general' | 'ticket_type' | 'box_type';

export interface CommissionRule {
  id: string;
  appliesTo: CommissionRuleTarget;
  appliesToId?: string; 
  appliesToName?: string; 
  commissionType: CommissionRuleType;
  commissionValue: number;
  description?: string;
}
export interface EventPromoterAssignment { // Almacenado dentro de BusinessManagedEntity (evento o promoción)
  promoterProfileId: string; // ID del BusinessPromoterLink o UID del PlatformUser promotor
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
  quantity?: number; 
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

export interface BusinessManagedEntity { // Promociones, Eventos, Encuestas creadas por el negocio
  id: string; 
  businessId: string;
  type: BusinessEntityType;
  name: string;
  description: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
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
  // Para UI pública (denormalizado)
  businessName?: string; 
  businessLogoUrl?: string;
  businessCustomUrlPath?: string;
  createdAt?: string; // ISO string
}

export interface PromoterProfile { // Perfil global de un promotor (si se decide gestionarlos globalmente)
  id: string; 
  name: string;
  email: string;
  phone?: string;
  dni?: string;
}

export interface BusinessPromoterLink { // Vínculo entre un negocio y un promotor
  id: string; 
  businessId: string;
  promoterDni: string; 
  promoterName: string; 
  promoterEmail: string; 
  promoterPhone?: string;
  commissionRate?: string; // Tasa general de comisión para este promotor en este negocio
  isActive: boolean;
  isPlatformUser: boolean; // True si el DNI del promotor corresponde a un PlatformUser con rol 'promoter'
  platformUserUid?: string; // UID de Firebase Auth si isPlatformUser es true
  joinDate: Timestamp | string; 
}


export type BusinessClientType = 'qr' | 'vip';

export interface BusinessClientView { // Para la vista de clientes del negocio
  id: string;
  clientType: BusinessClientType;
  name: string;
  surname: string;
  dni: string;
  phone?: string;
  email?: string;
  relevantDate: string; // registrationDate para QrClient, joinDate para SocioVipMember
  isVip: boolean;
  // Campos específicos de VIP
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
  uid?: string; // Solo para creación, UID de Firebase Auth
  dni: string;
  name: string;
  email: string;
  roles: PlatformUserRole[]; // Array de roles
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

export interface NewQrClientFormData { 
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
  maxAttendance?: number; // Calculado, pero puede estar en el form state para mostrar
  isActive: boolean;
  imageUrl?: string;
  aiHint?: string;
  termsAndConditions?: string;
}

export interface BusinessPromoterFormData { // Para el formulario de vincular/editar promotor al negocio
  // DNI se maneja en el paso previo de verificación
  promoterName: string;
  promoterEmail: string;
  promoterPhone?: string;
  commissionRate?: string; 
}

export interface PromoterCommissionEntry { 
    id: string;
    businessName: string;
    entityName: string;
    entityType: 'promotion' | 'event';
    codesRedeemedByPromoter: number; 
    commissionRate: string; 
    commissionEarned: number;
    paymentStatus: 'Pendiente' | 'Pagado';
    period: string; 
}

export interface TicketTypeFormData {
  name: string;
  cost: number;
  description?: string;
  quantity?: number; 
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

// Para el flujo "DNI-primero"
export interface DniCheckResultBase {
  dni: string;
  existsAsPlatformUser?: PlatformUser;
  existsAsSocioVip?: SocioVipMember;
  existsAsQrClient?: QrClient;
}

export interface InitialDataForPlatformUserCreation {
  dni: string;
  name?: string;
  email?: string;
  existingUserIsPlatformUser?: boolean; // True si el DNI ya es un PlatformUser
  existingPlatformUserRoles?: PlatformUserRole[]; 
  preExistingUserType?: 'QrClient' | 'SocioVipMember'; // Si se encontró como otro tipo pero no como PlatformUser
}

export interface InitialDataForSocioVipCreation {
  dni: string;
  name?: string;
  surname?: string;
  phone?: string;
  dob?: string; // ISO string
  email?: string;
  existingUserType?: 'QrClient' | 'PlatformUser'; // Tipo de usuario preexistente si lo hay
}

export interface InitialDataForPromoterLink {
  dni: string;
  existingLink?: BusinessPromoterLink; 
  existingPlatformUserPromoter?: PlatformUser; // Si el DNI es un PlatformUser con rol 'promoter'
  qrClientData?: QrClient; 
  socioVipData?: SocioVipMember; 
}

    