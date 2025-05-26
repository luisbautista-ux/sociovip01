
export interface PromotionDetails {
  id: string;
  title: string;
  description: string;
  validUntil: string; // Date string
  imageUrl: string;
  promoCode: string; // Unique code for this promotion
  aiHint: string; // Hint for placeholder image
}

export type QrCodeStatus = 'generated' | 'utilized' | 'expired';

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
  user: QrClient; // User who generated this specific promotional QR
  promotion: PromotionDetails;
  qrImageUrl: string;
  code: string; // Validated promoCode used
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
  totalPlatformUsers: number;
  totalPromotionsActive: number;
  totalQrCodesGenerated: number;
  totalQrClients: number; // Total QrClient records
  totalSocioVipMembers: number; // Total SocioVipMember records
}

export interface PromotionAnalyticsData {
  month: string;
  promotionsCreated: number;
  qrCodesGenerated: number;
  qrCodesUtilized: number;
}

export interface Business {
  id: string;
  name: string;
  contactEmail: string;
  joinDate: string;
  activePromotions: number;
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'business_admin' | 'staff';
  businessId?: string;
  lastLogin: string;
}

// Form data types
export interface BusinessFormData {
  name: string;
  contactEmail: string;
}

export interface PlatformUserFormData {
  name: string;
  email: string;
  role: 'superadmin' | 'business_admin' | 'staff';
  businessId?: string;
}

// Form data for creating/editing a SocioVipMember
export interface SocioVipMemberFormData {
  name: string;
  surname: string;
  dni: string;
  phone: string;
  dob: Date; // Using Date type for form, will convert to string
  email: string;
  address?: string;
  profession?: string;
  preferences?: string; // Comma-separated for textarea, convert to array
  loyaltyPoints: number;
  membershipStatus: 'active' | 'inactive' | 'pending_payment' | 'cancelled';
}

// Form data for creating a new QrClient (public page)
export interface NewQrClientFormData {
  dni: string;
  name: string;
  surname: string;
  phone: string;
  dob: Date; // Using Date type for form, will convert to string
}
