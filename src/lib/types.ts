
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
  dob: string; // Date of Birth, YYYY-MM-DD'T'HH:mm:ss
  registrationDate: string; // ISO date string of first QR generation
}

export interface QrCodeData {
  user: QrClient;
  promotion: PromotionDetails; 
  code: string; 
  status: QrCodeStatusGenerated; 
}

export interface SocioVipMember {
  id: string; // Firestore document ID
  dni: string; 
  name: string;
  surname: string;
  phone: string;
  dob: string; // YYYY-MM-DD'T'HH:mm:ss
  email: string; 
  address?: string;
  profession?: string;
  preferences?: string[]; 
  loyaltyPoints: number;
  membershipStatus: 'active' | 'inactive' | 'pending_payment' | 'cancelled';
  staticQrCodeUrl?: string; 
  joinDate: string; // ISO date string
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

export interface Business {
  id: string; // Firestore document ID
  name: string;
  contactEmail: string; 
  joinDate: string; // ISO date string
  activePromotions: number; 
}

export type PlatformUserRole = 'superadmin' | 'business_admin' | 'staff' | 'promoter' | 'host';

export interface PlatformUser {
  id: string; // Firestore document ID (this is separate from auth uid)
  uid: string; // Firebase Auth UID - this is the critical link to the auth user
  dni: string; 
  name: string;
  email: string; 
  roles: PlatformUserRole[]; // Changed from role to roles (array)
  businessId?: string | null; 
  lastLogin: string; // ISO date string
}

export type BusinessEntityType = 'promotion' | 'event' | 'survey';

export interface GeneratedCode {
  id: string; // Sub-document ID or unique ID within an array
  value: string; 
  entityId: string; 
  status: QrCodeStatusGenerated; 
  generatedByName: string; 
  generatedDate: string; 
  redemptionDate?: string; 
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
  startDate: string; 
  endDate: string; 
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
  dni?: string; // Might be good to add DNI here too for consistency
}

export interface BusinessPromoterLink { 
  id: string; // Firestore document ID
  businessId: string;
  promoterProfileId: string; // Links to PromoterProfile
  promoterName: string; // Denormalized for easy display
  promoterEmail: string; // Denormalized for easy display
  commissionRate?: string; 
  isActive: boolean;
  joinDate: string;
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
}

export interface PlatformUserFormData {
  dni: string; 
  name: string;
  email: string;
  role: PlatformUserRole; // The form will handle one role at a time for now
  businessId?: string;
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
  promoterDni?: string; // Add DNI for linking/creating promoter profile
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
    
