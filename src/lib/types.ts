
export interface UserData {
  id: string;
  name: string;
  surname: string;
  phone: string;
  dob: string; // Date of Birth
  dni: string; // Document ID
}

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

export interface QrCodeData {
  user: UserData;
  promotion: PromotionDetails;
  qrImageUrl: string;
  code: string; // This would be the validatedPromoCode
  status: QrCodeStatus;
}

// Admin Panel Specific Types
export interface AdminDashboardStats {
  totalBusinesses: number;
  totalPlatformUsers: number; // Admins/managers of businesses using the SaaS
  totalPromotionsActive: number;
  totalQrCodesGenerated: number;
  totalEndUsersRegistered: number; // End users who registered for QR codes
}

export interface RegisteredClient extends UserData {
  registrationDate: string; // Date of first QR generation
  lastPromotionId?: string;
  lastPromotionTitle?: string;
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

export interface PlatformUser { // Admin user for a business, or superadmin
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'business_admin' | 'staff';
  businessId?: string; // if not superadmin
  lastLogin: string;
}
