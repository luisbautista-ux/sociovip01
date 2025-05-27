
// src/lib/types.ts
import type { Timestamp } from "firebase/firestore";

export interface PromotionDetails { // For public display
  id: string;
  title: string;
  description: string;
  validUntil: string; // Date string
  imageUrl: string;
  promoCode: string;
  aiHint: string;
  type: 'promotion' | 'event';
  termsAndConditions?: string;
}

export type QrCodeStatusGenerated = 'available' | 'redeemed' | 'expired';

export interface QrClient {
  id: string; // Firestore document ID
  dni: string;
  name: string;
  surname: string;
  phone: string;
  dob: Timestamp | string; // Date of Birth, YYYY-MM-DD'T'HH:mm:ss or Timestamp
  registrationDate: Timestamp | string; // ISO date string or Timestamp
}

export interface QrCodeData {
  user: QrClient;
  promotion: PromotionDetails;
  code: string;
  status: QrCodeStatusGenerated;
}

export const BUSINESS_TYPES = [
  "Comercio",
  "Servicios",
  "Manufactura",
  "Agricultura",
  "Bienes raíces",
  "Turismo",
  "Minera",
  "Tecnología e informática",
  "Finanzas",
  "Energía",
  "Construcción",
  "Transporte y logística",
  "Otro",
] as const;

export type BusinessType = typeof BUSINESS_TYPES[number];


export interface Business {
  id: string; // Firestore document ID
  name: string; // Nombre comercial
  contactEmail: string;
  joinDate: Timestamp | string; // ISO date string or Timestamp
  activePromotions: number; // Este campo podría ser calculado o manejado de otra forma
  ruc?: string;
  razonSocial?: string; // Nombre legal
  department?: string;
  province?: string;
  district?: string;
  address?: string;
  managerName?: string;
  managerDni?: string;
  businessType?: BusinessType;
}

export type PlatformUserRole = 'superadmin' | 'business_admin' | 'staff' | 'promoter' | 'host';

export interface PlatformUser {
  id: string; // Firestore document ID
  uid: string; // Firebase Auth UID
  dni: string;
  name: string;
  email: string;
  roles: PlatformUserRole[];
  businessId?: string | null;
  lastLogin: Timestamp | string; // ISO date string or Timestamp
}

export interface SocioVipMember {
  id: string; // Firestore document ID
  dni: string;
  name: string;
  surname: string;
  phone: string;
  dob: Timestamp | string; // YYYY-MM-DD'T'HH:mm:ss or Timestamp
  email: string;
  address?: string;
  profession?: string;
  preferences?: string[];
  loyaltyPoints: number;
  membershipStatus: 'active' | 'inactive' | 'pending_payment' | 'cancelled';
  staticQrCodeUrl?: string;
  joinDate: Timestamp | string; // ISO date string or Timestamp
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

export interface PromotionAnalyticsData {
  month: string;
  promotionsCreated: number;
  qrCodesGenerated: number;
  qrCodesUtilized: number;
}

export interface RegisteredClient { // Used in AdminAnalyticsPage for mock data
  date: string; // "dd MMM"
  newRegistrations: number;
}

export type BusinessEntityType = 'promotion' | 'event' | 'survey';

export interface GeneratedCode {
  id: string; // Sub-document ID or unique ID within an array
  value: string;
  entityId: string;
  status: QrCodeStatusGenerated;
  generatedByName: string;
  generatedDate: string; // ISO date string
  redemptionDate?: string; // ISO date string
  redeemedByInfo?: {
    dni: string;
    name: string;
    phone?: string;
  };
  observation?: string;
  isVipCandidate?: boolean;
}

export interface EventPromoterAssignment {
  promoterProfileId: string;
  promoterName: string;
  promoterEmail?: string;
  commissionRate?: string;
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

export interface BusinessManagedEntity {
  id: string; // Firestore document ID
  businessId: string;
  type: BusinessEntityType;
  name: string;
  description: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  usageLimit?: number;
  maxAttendance?: number;
  isActive: boolean;
  imageUrl?: string;
  aiHint?: string;
  termsAndConditions?: string;
  generatedCodes?: GeneratedCode[];
  ticketTypes?: TicketType[];
  eventBoxes?: EventBox[];
  assignedPromoters?: EventPromoterAssignment[];
}

export interface PromoterProfile {
  id: string; // Firestore document ID for global promoter profiles
  name: string;
  email: string;
  phone?: string;
  dni?: string;
}

export interface BusinessPromoterLink {
  id: string; // Firestore document ID
  businessId: string;
  promoterProfileId: string;
  promoterName: string; // Denormalized for easier display
  promoterEmail: string; // Denormalized
  commissionRate?: string;
  isActive: boolean;
  joinDate: Timestamp | string; // ISO date string or Timestamp
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
  relevantDate: string; // registrationDate for QrClient, joinDate for SocioVipMember
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
}

export interface PlatformUserFormData {
  dni: string;
  name: string;
  email: string;
  roles: PlatformUserRole[];
  businessId?: string;
}

export interface SocioVipMemberFormData {
  dni: string;
  name: string;
  surname: string;
  phone: string;
  dob: Date; // Date object from form, will be converted to string for storage
  email: string;
  address?: string;
  profession?: string;
  preferences?: string;
  loyaltyPoints: number;
  membershipStatus: 'active' | 'inactive' | 'pending_payment' | 'cancelled';
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
  maxAttendance?: number;
  isActive: boolean;
  imageUrl?: string;
  aiHint?: string;
  termsAndConditions?: string;
}

export interface BusinessPromoterFormData {
  promoterName: string;
  promoterEmail: string;
  promoterPhone?: string;
  promoterDni?: string; // DNI of the promoter profile
  commissionRate?: string; // Commission specific to this business link
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

export interface EventPromoterAssignmentFormData {
    promoterProfileId: string;
    commissionRate?: string;
    notes?: string;
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

// For DNI verification flow in Admin Users
export interface InitialDataForPlatformUserCreation {
  dni: string;
  name?: string;
  email?: string;
  existingUserIsPlatformUser?: boolean;
  existingPlatformUser?: PlatformUser; // Full PlatformUser data if it exists
  existingPlatformUserRoles?: PlatformUserRole[];
  // To indicate if DNI was found as QrClient or SocioVip (but not PlatformUser)
  preExistingUserType?: 'QrClient' | 'SocioVipMember'; 
}

export interface InitialDataForSocioVipCreation {
  dni: string;
  name?: string;
  surname?: string;
  phone?: string;
  dob?: string; // ISO string, e.g., "1990-05-15T12:00:00"
  email?: string;
  preExistingUserType?: 'QrClient' | 'PlatformUser';
  // If the DNI already corresponds to an existing SocioVipMember (for edit flow)
  existingSocioVipProfile?: SocioVipMember;
}
