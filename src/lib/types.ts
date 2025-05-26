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
}

export type QrCodeStatus = 'generated' | 'utilized' | 'expired';

export interface QrCodeData {
  user: UserData;
  promotion: PromotionDetails;
  qrImageUrl: string;
  code: string;
  status: QrCodeStatus;
}
