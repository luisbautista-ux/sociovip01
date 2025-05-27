
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { BusinessManagedEntity } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isEntityCurrentlyActivatable(entity: BusinessManagedEntity | null | undefined): boolean {
  if (!entity || !entity.isActive) {
    return false;
  }

  try {
    const now = new Date();
    const entityStartDateObj = new Date(entity.startDate);
    const entityEndDateObj = new Date(entity.endDate);

    if (isNaN(entityStartDateObj.getTime()) || isNaN(entityEndDateObj.getTime())) {
      console.error("Invalid date string for entity:", entity.name, entity.startDate, entity.endDate);
      return false; 
    }

    // Normalize to compare dates only, considering full day
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const effectiveStartDate = new Date(entityStartDateObj.getFullYear(), entityStartDateObj.getMonth(), entityStartDateObj.getDate());
    // Set end date to the very end of the day to include the full end day
    const effectiveEndDate = new Date(entityEndDateObj.getFullYear(), entityEndDateObj.getMonth(), entityEndDateObj.getDate(), 23, 59, 59, 999);
    
    return today >= effectiveStartDate && today <= effectiveEndDate;
  } catch (error) {
    console.error("Error parsing dates for entity:", entity.name, error);
    return false;
  }
}
