
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Ghost } from "lucide-react";

export default function BusinessEventsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gradient flex items-center">
        Eventos
      </h1>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Módulo en Construcción</CardTitle>
        </CardHeader>
        <CardContent className="h-60 flex flex-col items-center justify-center text-center">
          <Ghost className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">La nueva funcionalidad de Eventos está siendo construida.</p>
        </CardContent>
      </Card>
    </div>
  );
}
