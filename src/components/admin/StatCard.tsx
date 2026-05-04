
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  iconColor?: string;
}

export function StatCard({ title, value, icon: Icon, description, iconColor }: StatCardProps) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const numericValue = typeof value === 'string' ? parseFloat(value.replace('%', '')) : value;
    if (isNaN(numericValue)) {
      // If value is not a number (e.g., a string after animation), just display it.
      // This part is tricky, so we'll focus on numeric values for animation.
      return;
    }

    let start = 0;
    const end = numericValue;
    const duration = 1000; // 1 second
    const frameRate = 60; // 60fps
    const totalFrames = duration / (1000 / frameRate);
    const increment = end / totalFrames;

    const counter = setInterval(() => {
      start += increment;
      if (start >= end) {
        setAnimatedValue(end);
        clearInterval(counter);
      } else {
        setAnimatedValue(Math.ceil(start));
      }
    }, 1000 / frameRate);

    return () => clearInterval(counter);
  }, [value]);
  
  const displayValue = typeof value === 'string' && value.includes('%') 
    ? `${animatedValue}%` 
    : Math.floor(animatedValue);

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={cn("h-5 w-5 text-primary", iconColor)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{displayValue}</div>
        {description && (
          <p className="text-xs text-muted-foreground pt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
