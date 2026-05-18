// src/lib/types.ts
import type { Timestamp } from "firebase/firestore";
import type { BUSINESS_TYPES, ALL_PLATFORM_USER_ROLES, AVAILABLE_FONTS } from "./constants"; 

export interface TicketType {
  id: string;
  eventId: string; 
  businessId: string;
  name: string;
  cost: number;
  description?: string;
  quantity?: number; 
  color?: string;
}

export interface EventSchedule {
  id: string;
  label: string; // Ej: "Día 1 - La Yunza"
  startDate: string;
  endDate: string;
}

export interface CheckIn {
  scheduleId: string;
  scheduleLabel: string;
  timestamp: string;
  validatedBy: {
    uid: string;
    name: string;
  };
}

export interface PromotionDetails { 
  id: string;
  title: string;
  description: string;
  validUntil: string; 
  imageUrl: string;
  promoCode: string;
  qrValue: string;
  aiHint: string;
  type: 'promotion' | 'event';
  termsAndConditions?: string;
  qrTemplateImageUrl?: string;
  qrTemplateLayout?: QrTemplateLayout;
  ticketType?: Pick<TicketType, 'name' | 'cost' | 'color'>;
  schedules?: EventSchedule[]; // Añadido para mostrar en QR
}

export type QrCodeStatusGenerated = 'available' | 'redeemed' | 'used' | 'expired';

export interface QrClient {
  id: string; 
  dni: string;
  name: string;
  surname: string;
  phone: string;
  dob: Timestamp | string; 
  registrationDate: Timestamp | string;
  email?: string;
  generatedForBusinessId?: string;
  associatedBusinessIds?: string[];
}

export interface QrCodeData { 
  user: QrClient;
  promotion: PromotionDetails; 
  code: string;
  status: QrCodeStatusGenerated;
}

export type BusinessType = typeof BUSINESS_TYPES[number];

export interface Business {
  id: string; 
  name: string; 
  contactEmail: string;
  joinDate: Timestamp | string; 
  ruc?: string;
  razonSocial?: string; 
  department?: string;
  province?: string;
  district?: string;
  address?: string;
  managerName?: string;
  managerDni?: string;
  businessType?: BusinessType;
  logoUrl?: string;
  publicCoverImageUrls?: string[];
  publicVideoUrls?: string[];
  slogan?: string;
  publicContactEmail?: string;
  publicPhone?: string;
  personalPhone?: string;
  publicAddress?: string;
  customUrlPath?: string | null; 
  primaryColor?: string;
  secondaryColor?: string;
  description?: string;
  gmailRefreshToken?: string;
}

export type PlatformUserRole = typeof ALL_PLATFORM_USER_ROLES[number];

export interface PlatformUser {
  id: string; 
  uid: string; 
  dni: string;
  name: string;
  email: string;
  roles: PlatformUserRole[];
  businessId?: string | null; 
  businessIds?: string[];
  lastLogin: Timestamp | string; 
  phone?: string;
  photoURL?: string;
  dob?: Timestamp | string;
  assignedBusinessId?: string | null;
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
  totalSocioVipMembers: number;
  totalQrCodesGenerated: number;
}

export interface BusinessDashboardStats {
  activePromotions: number;
  totalCodesCreated: number; 
  totalQrUsed: number; 
}

export interface PromotionAnalyticsData { 
  month: string;
  promotionsCreated: number; 
  qrCodesGenerated: number;
  qrCodesUtilized: number;
}

export interface RegisteredClient { 
  date: string; 
  newRegistrations: number;
}

export type BusinessEntityType = 'promotion' | 'event';

export type CommissionStatus = 'unpaid' | 'paid';

export interface GeneratedCode { 
  id: string; 
  entityId: string; 
  value: string;
  status: QrCodeStatusGenerated;
  generatedByName: string; 
  generatedByUid?: string;
  generatedDate: string; 
  redemptionDate?: string | null;
  redeemedByInfo?: {
    dni: string;
    name: string;
    phone?: string;
  } | null;
  usedDate?: string | null; // Legacy single use
  usedByInfo?: {
    uid: string;
    name: string;
  } | null;
  checkIns?: CheckIn[]; // Soporte para múltiples entradas
  observation?: string | null;
  isVipCandidate?: boolean;
  ownerName?: string;
  ownerDni?: string;
  ownerPhone?: string;
  commissionGenerated?: number;
  commissionStatus?: CommissionStatus;
  paymentId?: string | null;
  ticketTypeId?: string;
  ticketTypeName?: string;
}

export type CommissionRuleType = 'fixed' | 'percentage';
export type CommissionRuleTarget = 'event_general' | 'ticket_type' | 'box_type';

export interface CommissionRule {
  id: string;
  appliesTo: CommissionRuleTarget;
  appliesToId?: string; 
  appliesToName?: string; 
  commissionType: CommissionRuleType;
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

export interface EventBox {
  id: string;
  eventId: string;
  businessId: string;
  name: string;
  cost: number;
  description?: string;
  status: 'available' | 'reserved' | 'sold';
  capacity?: number;
  promoterId?: string;
  promoterName?: string;
  ownerName?: string;
  ownerDni?: string;
  ownerPhone?: string;
}

export interface QrTemplateLayout {
  qr: { x: number; y: number; size: number; color?: string; };
  name: { x: number; y: number; size?: number; color?: string; fontFamily?: string; };
  dni: { x: number; y: number; size?: number; color?: string; fontFamily?: string; };
  promoTitle: { x: number; y: number; size?: number; color?: string; fontFamily?: string; };
  ticketType?: { x: number; y: number; width: number; height: number; textColor?: string; size?: number; fontFamily?: string; };
}

export interface BusinessManagedEntity { 
  id: string; 
  businessId: string;
  type: BusinessEntityType;
  name: string;
  description: string;
  startDate: string; 
  endDate: string; 
  locationAddress?: string;
  usageLimit?: number; 
  isActive: boolean;
  isPublicAccess?: boolean;
  imageUrl?: string;
  imageObjectPosition?: string;
  aiHint?: string;
  termsAndConditions?: string;
  generatedCodes?: GeneratedCode[];
  schedules?: EventSchedule[]; // Múltiples horarios/fechas
  maxAttendance?: number;
  ticketTypes?: TicketType[];
  eventBoxes?: EventBox[];
  assignedPromoters?: EventPromoterAssignment[];
  businessName?: string; 
  businessLogoUrl?: string;
  businessCustomUrlPath?: string | null;
  createdAt?: string; 
  qrTemplateImageUrl?: string;
  templateObjectPosition?: string;
  qrTemplateLayout?: QrTemplateLayout;
}

export interface PromoterEntityView extends BusinessManagedEntity {
    promoterCodesCreated: number;
    promoterCodesUsed: number;
}

export interface PromoterProfile { 
  id: string; 
  name: string;
  email: string;
  phone?: string;
  dni?: string;
}

export interface BusinessPromoterLink { 
  id: string; 
  businessId: string;
  promoterDni: string; 
  promoterName: string; 
  promoterEmail: string; 
  promoterPhone?: string;
  commissionRate?: string; 
  isActive: boolean;
  isPlatformUser: boolean; 
  platformUserUid?: string; 
  joinDate: Timestamp | string; 
}

export interface BusinessPromoterLinkWithCommissions extends BusinessPromoterLink {
  pendingAmount: number;
  paidAmount: number;
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
  logoFile?: File | null;
  publicCoverImageUrls?: string[];
  publicVideoUrls?: string[];
  slogan?: string;
  publicContactEmail?: string;
  publicPhone?: string;
  publicAddress?: string;
  customUrlPath?: string | null;
}

export interface PlatformUserFormData {
  uid?: string; 
  dni: string;
  name: string;
  email?: string;
  phone: string;
  dob: Date;
  roles: PlatformUserRole[]; 
  businessId?: string | null;
  businessIds?: string[];
  password?: string;
  photoURL?: string;
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
  usageLimit?: number | string;
  isActive: boolean;
  imageUrl?: string;
  imageFile?: File | null;
  imageObjectPosition?: string;
  templateObjectPosition?: string;
  termsAndConditions?: string;
  qrTemplateImageUrl?: string;
  qrTemplateFile?: File | null;
  qrTemplateLayout?: QrTemplateLayout;
}

export interface BusinessEventFormData {
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  locationAddress?: string;
  maxAttendance?: number;
  unlimitedAttendance?: boolean;
  isActive: boolean;
  isPublicAccess: boolean;
  imageUrl?: string;
  imageFile?: File | null;
  aiHint?: string;
  termsAndConditions?: string;
  schedules?: EventSchedule[];
}

export interface BusinessPromoterFormData { 
  promoterName: string;
  promoterEmail: string;
  promoterDni: string;
  promoterPhone?: string;
  commissionRate?: string; 
  password?: string;
}
 
export interface SpecificCodeFormValues {
  specificCode: string;
}

export interface DniEntryValues {
  dni: string;
}

export interface InitialDataForPlatformUserCreation {
  dni: string;
  name?: string;
  email?: string;
  existingPlatformUser?: PlatformUser; 
  existingPlatformUserRoles?: PlatformUserRole[];
  preExistingUserType?: 'QrClient' | 'SocioVipMember';
  qrClientData?: QrClient;
  socioVipData?: SocioVipMember;
}

export interface InitialDataForSocioVipCreation {
  dni: string;
  name?: string;
  surname?: string;
  phone?: string;
  dob?: string; 
  email?: string;
  existingUserType?: 'QrClient' | 'PlatformUser'; 
  platformUserData?: PlatformUser; 
  qrClientData?: QrClient;     
}

export interface InitialDataForPromoterLink {
  dni: string;
  existingLink?: BusinessPromoterLink; 
  existingPlatformUserPromoter?: PlatformUser; 
  qrClientData?: QrClient; 
  socioVipData?: SocioVipMember;
}

export interface PlatformSettings {
  defaultBusinessesForFreeUsers?: string[];
  contactPhone?: string;
  contactEmail?: string;
}

export interface TicketTypeFormData {
  name: string;
  cost: number;
  description?: string;
  quantity?: number;
  color?: string;
}

export interface EventBoxFormData {
  name: string;
  cost: number;
  description?: string;
  status: 'available' | 'reserved' | 'sold';
  capacity?: number;
  promoterName?: string;
  ownerName?: string;
  ownerDni?: string;
  ownerPhone?: string;
}

export interface BatchBoxFormData {
  prefix: string;
  fromNumber: number;
  toNumber: number;
  cost: number;
  capacity?: number;
  description?: string;
}

export interface AutomationRule {
  id?: string;
  businessId: string;
  type: 'loyalty' | 'retention' | 'birthday';
  name: string;
  isEnabled: boolean;
  threshold: number;
  actionPromoId: string;
  lastRun?: Timestamp | string;
}
