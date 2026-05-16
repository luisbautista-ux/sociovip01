
// src/app/business/[businessId]/public/page.tsx
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import type { Business, BusinessManagedEntity } from "@/lib/types";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BusinessConversationLayout } from "@/components/business/BusinessConversationLayout";
import { SocioVipLogo } from "@/components/icons";

/* ──────────────────────────────────────────
   Data fetchers (server-side)
────────────────────────────────────────── */

async function getBusinessDetails(businessId: string): Promise<Business | null> {
  if (!businessId || typeof businessId !== "string" || businessId.trim() === "") {
    return null;
  }
  try {
    const snap = await getDoc(doc(db, "businesses", businessId));
    if (!snap.exists()) return null;

    const data = snap.data();
    return {
      id: snap.id,
      name: data.name || "Negocio sin nombre",
      contactEmail: data.contactEmail || "",
      joinDate:
        data.joinDate instanceof Timestamp
          ? data.joinDate.toDate().toISOString()
          : String(data.joinDate || new Date().toISOString()),
      activePromotions: data.activePromotions || 0,
      ruc: data.ruc,
      razonSocial: data.razonSocial,
      department: data.department,
      province: data.province,
      district: data.district,
      address: data.address,
      managerName: data.managerName,
      managerDni: data.managerDni,
      businessType: data.businessType,
      customUrlPath: data.customUrlPath,
      logoUrl: data.logoUrl,
      publicCoverImageUrls: data.publicCoverImageUrls || [],
      publicVideoUrls: data.publicVideoUrls || [],
      slogan: data.slogan,
      publicContactEmail: data.publicContactEmail,
      publicPhone: data.publicPhone,
      publicAddress: data.publicAddress,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
    } as Business;
  } catch (error) {
    console.error(`Error fetching business ${businessId}:`, error);
    return null;
  }
}

async function getBusinessEntities(
  business: Business
): Promise<BusinessManagedEntity[]> {
  const businessId = business.id;
  if (!businessId || typeof businessId !== "string" || businessId.trim() === "") {
    return [];
  }
  try {
    const entitiesQuery = query(
      collection(db, "businessEntities"),
      where("businessId", "==", businessId),
      where("isActive", "==", true)
    );
    const snapshot = await getDocs(entitiesQuery);
    const now = new Date().toISOString();

    const entities = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();

        const toStr = (v: unknown): string => {
          if (v instanceof Timestamp) return v.toDate().toISOString();
          if (typeof v === "string") return v;
          if (v instanceof Date) return v.toISOString();
          return now;
        };

        return {
          id: docSnap.id,
          businessId: data.businessId,
          type: data.type,
          name: data.name,
          description: data.description,
          startDate: toStr(data.startDate),
          endDate: toStr(data.endDate),
          usageLimit: data.usageLimit,
          maxAttendance: data.maxAttendance,
          isActive: data.isActive,
          imageUrl: data.imageUrl,
          aiHint: data.aiHint,
          termsAndConditions: data.termsAndConditions,
          businessName: business.name,
          businessLogoUrl: business.logoUrl,
          businessCustomUrlPath: business.customUrlPath,
          businessVideoUrls: business.publicVideoUrls || [],
          businessImageUrls: business.publicCoverImageUrls || [],
        } as any;
      })
      .filter((entity) => isEntityCurrentlyActivatable(entity));

    return entities;
  } catch (error) {
    console.error(`Error fetching entities for business ${businessId}:`, error);
    return [];
  }
}

/* ──────────────────────────────────────────
   Page component
────────────────────────────────────────── */

export default async function BusinessPublicPage({
  params,
}: {
  params: { businessId: string };
}) {
  const businessDetails = await getBusinessDetails(params.businessId);
  const entities = businessDetails ? await getBusinessEntities(businessDetails) : [];

  if (!businessDetails) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#050510]">
        <SocioVipLogo className="h-20 w-20 text-primary mb-6" />
        <h1 className="text-3xl font-bold text-destructive mb-4">
          Negocio No Encontrado
        </h1>
        <p className="text-white/50 mb-6 text-center">
          No pudimos encontrar la información para el negocio solicitado.
        </p>
        <Link href="/" passHref>
          <Button>Volver a la Página Principal</Button>
        </Link>
      </div>
    );
  }

  const promotions = entities.filter((e) => e.type === "promotion");
  const events = entities.filter((e) => e.type === "event");

  return (
    <BusinessConversationLayout
      business={businessDetails}
      promotions={promotions}
      events={events}
    />
  );
}
