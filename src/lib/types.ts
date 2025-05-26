
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
