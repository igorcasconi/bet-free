import {
  getAnalytics,
  isSupported,
  type Analytics,
  type CustomEventName,
  logEvent,
} from "firebase/analytics";

import { firebaseApp } from "@/lib/firebase/client";

export type AnalyticsEventName =
  | "login"
  | "prediction_created"
  | "prediction_won"
  | "prediction_lost"
  | "dashboard_viewed"
  | "profile_viewed"
  | "matches_viewed";

// Cached across the module's lifetime so `isSupported()`/`getAnalytics()` run
// at most once, regardless of how many `trackEvent` calls arrive before or
// after initialization resolves. Lazily created on first `trackEvent` call
// (not eagerly at module load) so importing this module never triggers SDK
// work in SSR/node contexts that never call `trackEvent`.
let analyticsPromise: Promise<Analytics | null> | null = null;

function getAnalyticsInstance(): Promise<Analytics | null> {
  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
      .catch((error) => {
        console.error("Firebase Analytics initialization failed", error);
        return null;
      });
  }

  return analyticsPromise;
}

export function trackEvent(name: AnalyticsEventName): void {
  if (typeof window === "undefined") return;

  // Fire-and-forget: chain onto the (cached) init promise instead of
  // awaiting, so calls made while initialization is still pending are not
  // dropped — they queue behind the same in-flight promise as the first call.
  getAnalyticsInstance()
    .then((analytics) => {
      if (!analytics) return;
      // `logEvent` has separate overloads per reserved GA4 event name (e.g.
      // "login") vs. custom names, which TS can't resolve against our own
      // union type at once. Widening to `CustomEventName<string>` (== plain
      // `string`) selects the generic overload without using `any`.
      logEvent(analytics, name as CustomEventName<string>);
    })
    .catch((error) => {
      console.error("Firebase Analytics trackEvent failed", error);
    });
}
