
export interface PromotionDetails { // For public display
  id: string;
  title: string;
  description: string;
  validUntil: string; // Date string
  imageUrl: string;
  promoCode: string; // Unique code for this promotion, might be optional if QR is direct
  aiHint: string; // Hint for placeholder image
}

export type QrCodeStatus = 'generated' | 'utilized' | 'expired' | 'active' | 'redeemed';

// Represents a client who generates QR codes via promotional codes (public page flow)
export interface QrClient {
  id: string;
  name: string;
  surname: string;
  phone: string;
  dob: string; // Date of Birth, YYYY-MM-DD
  dni: string; // Document ID
  registrationDate: string; // ISO date string of first QR generation
}

// Data for the QR code itself, linking a QrClient to a Promotion
export interface QrCodeData {
  user: QrClient;
  promotion: PromotionDetails; // The public view of the promotion
  qrImageUrl: string;
  code: string; // Validated promoCode used or a generated unique code
  status: QrCodeStatus;
}

// Represents a VIP Member with a detailed profile and membership
export interface SocioVipMember {
  id: string;
  name: string;
  surname: string;
  phone: string;
  dob: string; // YYYY-MM-DD
  dni: string;
  email: string; // For account login
  address?: string;
  profession?: string;
  preferences?: string[]; // Array of preference strings
  loyaltyPoints: number;
  membershipStatus: 'active' | 'inactive' | 'pending_payment' | 'cancelled';
  staticQrCodeUrl?: string; // URL to their static membership QR
  joinDate: string; // ISO date string
}

// Admin Panel Specific Types
export interface AdminDashboardStats {
  totalBusinesses: number;
  totalPlatformUsers: number; // Superadmins, Business Admins, Business Staff
  totalPromotionsActive: number; // Count of active BusinessEntity type promotion
  totalQrCodesGenerated: number; // All generated codes for promotions/events
  totalQrClients: number; // Total QrClient records
  totalSocioVipMembers: number; // Total SocioVipMember records
}

export interface PromotionAnalyticsData { // For SuperAdmin analytics overview
  month: string;
  promotionsCreated: number; // New BusinessEntity type promotion
  qrCodesGenerated: number;
  qrCodesUtilized: number;
}

// Business Entity (as created by SuperAdmin for the platform)
export interface Business {
  id: string;
  name: string;
  contactEmail: string; // Email of the primary contact/owner for platform comms
  joinDate: string;
  activePromotions: number; // Potentially count of active BusinessEntity type promotion
}

// Users of the platform (SuperAdmins, Business Admins, Business Staff)
export interface PlatformUser {
  id: string;
  name: string;
  email: string; // Login email
  role: 'superadmin' | 'business_admin' | 'business_staff';
  businessId?: string; // Required if role is business_admin or business_staff
  lastLogin: string;
}


// ---- Types for Business Panel ----
export type BusinessEntityType = 'promotion' | 'event' | 'survey';

export interface BusinessManagedEntity { // Promotions, Events, Surveys created by a Business
  id: string;
  businessId: string;
  type: BusinessEntityType;
  name: string;
  description: string;
  startDate: string; // ISO Date
  endDate: string; // ISO Date
  usageLimit?: number; // Max number of times it can be used/redeemed
  isActive: boolean;
  imageUrl?: string; // Optional image for the entity
  aiHint?: string;
  // Specific fields can be added later based on type, or use a details object
  // e.g., details: PromotionSpecificDetails | EventSpecificDetails | SurveySpecificDetails;
}

export interface PromoterProfile { // Global profile for a promoter
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface BusinessPromoterLink { // How a Business links to a Promoter
  id: string;
  businessId: string;
  promoterProfileId: string;
  commissionRate?: string; // e.g., "10%" or "S/5 por QR"
  isActive: boolean;
  joinDate: string;
}

export interface GeneratedQrCode {
  id: string;
  codeValue: string; // The actual code string (e.g., ABC123XYZ)
  entityId: string; // ID of BusinessManagedEntity (Promotion, Event, etc.)
  entityType: BusinessEntityType;
  status: QrCodeStatus; // 'generated', 'redeemed', 'expired'
  generatedByPromoterId?: string; // If a promoter generated it
  generatedByStaffId?: string; // If a staff member generated it
  qrClientId?: string; // If a QrClient redeemed/used it
  socioVipMemberId?: string; // If a SocioVipMember redeemed/used it
  generatedDate: string;
  redemptionDate?: string;
  assignedTo?: string; // e.g. DNI of person this code is for, if pre-assigned
}


// Form data types
export interface BusinessFormData {
  name: string;
  contactEmail: string;
}

export interface PlatformUserFormData {
  name: string;
  email: string;
  role: 'superadmin' | 'business_admin' | 'business_staff';
  businessId?: string;
}

export interface SocioVipMemberFormData {
  name: string;
  surname: string;
  dni: string;
  phone: string;
  dob: Date;
  email: string;
  address?: string;
  profession?: string;
  preferences?: string; // Comma-separated
  loyaltyPoints: number;
  membershipStatus: 'active' | 'inactive' | 'pending_payment' | 'cancelled';
}

export interface NewQrClientFormData { // From public page
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
}

export interface BusinessPromoterFormData { // For inviting/linking a promoter
  promoterName: string;
  promoterEmail: string;
  promoterPhone?: string;
  commissionRate?: string;
}
