"use client";

import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

interface StatusSwitchProps {
  eventId: string;
  initialStatus: boolean;
  onStatusChange: (eventId: string, newStatus: boolean) => Promise<void>;
  isSubmitting: boolean; // ✅ AÑADIR ESTA LÍNEA
}

export function StatusSwitch({ 
  eventId, 
  initialStatus, 
  onStatusChange,
  isSubmitting // ✅ AÑADIR ESTA LÍNEA
}: StatusSwitchProps) {
  const [isUpdating, setIsUpdating] = React.useState(false);
  // We manage the checked state internally to provide immediate feedback,
  // but it's initialized from the outside.
  const [isChecked, setIsChecked] = React.useState(initialStatus);

  // Sync with external changes
  React.useEffect(() => {
    setIsChecked(initialStatus);
  }, [initialStatus]);

  const handleCheckedChange = async (newStatus: boolean) => {
    setIsUpdating(true);
    setIsChecked(newStatus); // Optimistic UI update
    await onStatusChange(eventId, newStatus);
    setIsUpdating(false);
  };

  return (
    <div className="relative flex items-center h-6 w-11">
      {isUpdating && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}
      <Switch
        id={`status-switch-event-${eventId}`}
        checked={isChecked}
        onCheckedChange={handleCheckedChange}
        disabled={isSubmitting || isUpdating} // ✅ USAR LA PROPIEDAD RECIBIDA
        className={isUpdating ? "opacity-50" : ""}
      />
    </div>
  );
}