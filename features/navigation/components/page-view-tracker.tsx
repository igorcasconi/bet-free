"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import {
  trackEvent,
  type AnalyticsEventName,
} from "@/lib/analytics/track-event";

const ROUTE_EVENTS: Record<string, AnalyticsEventName> = {
  "/home": "dashboard_viewed",
  "/profile": "profile_viewed",
  "/matches": "matches_viewed",
};

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const event = ROUTE_EVENTS[pathname];
    if (!event) return;

    trackEvent(event);
  }, [pathname]);

  return null;
}
