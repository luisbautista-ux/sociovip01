
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { BusinessPromoterLink, InitialDataForPromoterLink, PlatformUser, QrClient, SocioVipMember } from "@/lib/types";
import { cn } from "@/lib/utils";

const DniEntrySchema = z.object({
  docType: z.enum(['dni', 'ce'], { required_error: "Debes seleccionar un tipo de documento." }),
  docNumber: z.string().min(1, "El número de documento es requerido."),
}).superRefine((data, ctx) => {
    if (data.docType === 'dni' && !/^\d{8}$/.test(data.docNumber)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El DNI debe tener 8 dígitos.", path: ['docNumber'] });
    } else if (data.docType === 'ce' && !/^\d{10,20}$/.test(data.docNumber)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El Carnet de Extranjería debe tener entre 10 y 20 dígitos.", path: ['docNumber'] });
    }
});

type DniEntryValues = z.infer<typeof DniEntrySchema>;

interface DniEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onDniVerified: (result: InitialDataForPromoterLink) => void;
  onAlreadyLinked: (link: BusinessPromoterLink) => void;
}

export function DniEntryDialog({ open, onOpenChange, isSubmitting, onDniVerified, onAlreadyLinked }: DniEntryDialogProps) {
  const { userProfile } = useAuth();
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const [alreadyLinkedData, setAlreadyLinkedData] = useState<BusinessPromoterLink | null>(null);

  const form = useForm<DniEntryValues>({
    resolver: zodResolver(DniEntrySchema),
    defaultValues: { docType: 'dni', docNumber: "" },
  });
  const watchedDocType = form.watch('docType');

  const checkDniForPromoterAndLink = async (dni: string, businessIdToCheck: string): Promise<InitialDataForPromoterLink> => {
      let result: InitialDataForPromoterLink = { dni };

      // 1. Check if this DNI is already linked as a promoter to THIS business
      const linksQuery = query(
        collection(db, "businessPromoterLinks"), 
        where("businessId", "==", businessIdToCheck), 
        where("promoterDni", "==", dni)
      );
      const linksSnapshot = await getDocs(linksQuery);
      if (!linksSnapshot.empty) {
        // Stop here, they are already linked. The dialog will handle this.
        result.existingLink = { id: linksSnapshot.docs[0].id, ...linksSnapshot.docs[0].data() } as BusinessPromoterLink;
        return result;
      }

      // 2. Check if a platformUser exists with this DNI, regardless of role
      const platformUserQuery = query(collection(db, "platformUsers"), where("dni", "==", dni));
      const platformUserSnapshot = await getDocs(platformUserQuery);

      if (!platformUserSnapshot.empty) {
          // A platform user exists! This is the person we want to link.
          result.existingPlatformUserPromoter = { id: platformUserSnapshot.docs[0].id, ...platformUserSnapshot.docs[0].data() } as PlatformUser;
          return result;
      }
      
      // 3. If no platform user, check legacy/other collections for data pre-population
      const qrClientQuery = query(collection(db, "qrClients"), where("dni", "==", dni));
      const qrClientSnapshot = await getDocs(qrClientQuery);
      if (!qrClientSnapshot.empty) {
          result.qrClientData = { id: qrClientSnapshot.docs[0].id, ...qrClientSnapshot.docs[0].data() } as QrClient;
          return result;
      }

      const socioVipQuery = query(collection(db, "socioVipMembers"), where("dni", "==", dni));
      const socioVipSnapshot = await getDocs(socioVipQuery);
      if (!socioVipSnapshot.empty) {
          result.socioVipData = { id: socioVipSnapshot.docs[0].id, ...socioVipSnapshot.docs[0].data() } as SocioVipMember;
      }
      
      return result;
  };

  const handleDniVerificationSubmit = async (values: DniEntryValues) => {
    if (!userProfile?.businessId) return;
    setInternalSubmitting(true);
    const result = await checkDniForPromoterAndLink(values.docNumber.trim(), userProfile.businessId);
    setInternalSubmitting(false);

    if (result.existingLink) {
      setAlreadyLinkedData(result.existingLink);
    } else {
      onDniVerified(result);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Paso 1: Verificar Documento del Promotor</DialogTitle>
            <DialogDescription>
              Ingresa el documento para verificar si ya existe o está vinculado.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleDniVerificationSubmit)} className="space-y-4 py-2">
              <FormField control={form.control} name="docType" render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Tipo de Documento</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={(value) => { field.onChange(value); form.setValue('docNumber', ''); form.clearErrors('docNumber'); }} defaultValue={field.value} className="grid grid-cols-2 gap-2">
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <Label htmlFor="docType-dni-promoter" className={cn("w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer", field.value === 'dni' && "bg-primary text-primary-foreground border-primary")}>
                          <FormControl><RadioGroupItem value="dni" id="docType-dni-promoter" className="sr-only" /></FormControl>DNI
                        </Label>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <Label htmlFor="docType-ce-promoter" className={cn("w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer", field.value === 'ce' && "bg-primary text-primary-foreground border-primary")}>
                          <FormControl><RadioGroupItem value="ce" id="docType-ce-promoter" className="sr-only" /></FormControl>Carnet de Extranjería
                        </Label>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="docNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Documento <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder={watchedDocType === 'dni' ? "8 dígitos" : "10-20 dígitos"} {...field} maxLength={20} onChange={(e) => field.onChange(e.target.value.replace(/[^0-9]/g, ''))} autoFocus disabled={isSubmitting || internalSubmitting} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting || internalSubmitting}>Cancelar</Button>
                <Button type="submit" variant="gradient" disabled={isSubmitting || internalSubmitting}>
                  {(isSubmitting || internalSubmitting) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verificar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!alreadyLinkedData} onOpenChange={(isOpen) => !isOpen && setAlreadyLinkedData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="text-yellow-500 mr-2 h-6 w-6"/> Promotor ya Vinculado
            </AlertDialogTitle>
            <AlertDialogDescription>
              El promotor con DNI/CE <span className="font-semibold">{alreadyLinkedData?.promoterDni}</span> ({alreadyLinkedData?.promoterName}) ya está vinculado a tu negocio.
              <br/><br/>
              No puedes volver a vincularlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlreadyLinkedData(null)} variant="gradient">
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
