import React, { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { useLocation } from "react-router-dom";
import { ALL_TOURS } from "@/data/tours";
import { matchesTourRoute } from "@/lib/tour-system";
import { useRole } from "@/hooks/useRole";

const STORAGE_KEY = "rocketboard-tours-completed";

function getCompletedTours(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCompletedTours(completed: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
}

const ACCESS_HIERARCHY = ["read_only", "learner", "author", "admin", "owner"];

// ─── Shared tour context ───────────────────────────────────────────────────
interface TourContextValue {
  activeTour: (typeof ALL_TOURS)[0] | null;
  activeTourId: string | null;
  shouldShowTour: (tourId: string) => boolean;
  completeTour: (tourId: string) => void;
  resetTour: (tourId: string) => void;
  resetAllTours: () => void;
  startTour: (tourId: string) => void;
  getCurrentPageTour: () => (typeof ALL_TOURS)[0] | null;
  setActiveTourId: (id: string | null) => void;
}

export const TourContext = createContext<TourContextValue | null>(null);

// ─── Provider — add this once inside BrowserRouter ────────────────────────
export function TourProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const location = useLocation();
  const { packAccessLevel } = useRole();
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const lastTourTime = useRef(0);
  const mountTime = useRef(Date.now());

  const shouldShowTour = useCallback((tourId: string): boolean => {
    const completed = getCompletedTours();
    return !completed[tourId];
  }, []);

  const completeTour = useCallback((tourId: string) => {
    const completed = getCompletedTours();
    completed[tourId] = Date.now();
    saveCompletedTours(completed);
    lastTourTime.current = Date.now();
    setActiveTourId(null);
  }, []);

  const resetTour = useCallback((tourId: string) => {
    const completed = getCompletedTours();
    delete completed[tourId];
    saveCompletedTours(completed);
  }, []);

  const resetAllTours = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getCurrentPageTour = useCallback(() => {
    return ALL_TOURS.find((tour) => {
      if (!matchesTourRoute(tour, location.pathname)) return false;
      if (tour.requiredRole) {
        const userIdx = ACCESS_HIERARCHY.indexOf(packAccessLevel);
        const reqIdx = ACCESS_HIERARCHY.indexOf(tour.requiredRole);
        if (userIdx < reqIdx) return false;
      }
      return true;
    }) || null;
  }, [location.pathname, packAccessLevel]);

  const startTour = useCallback((tourId: string) => {
    setActiveTourId(tourId);
  }, []);

  // Auto-trigger tour on page visit
  useEffect(() => {
    mountTime.current = Date.now();
    const timer = setTimeout(() => {
      const elapsed = Date.now() - mountTime.current;
      if (elapsed < 1800) return;
      if (Date.now() - lastTourTime.current < 5000) return;
      if (location.pathname.includes("/onboarding")) return;

      const tour = getCurrentPageTour();
      if (tour && shouldShowTour(tour.id)) {
        setActiveTourId(tour.id);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [location.pathname, getCurrentPageTour, shouldShowTour]);

  const activeTour = activeTourId
    ? ALL_TOURS.find((t) => t.id === activeTourId) || (console.warn(`[useTour] Tour not found: ${activeTourId}`), null)
    : null;

  return (
    <TourContext.Provider value={{
      activeTour,
      activeTourId,
      shouldShowTour,
      completeTour,
      resetTour,
      resetAllTours,
      startTour,
      getCurrentPageTour,
      setActiveTourId,
    }}>
      {children}
    </TourContext.Provider>
  );
}

// ─── Hook — all components call this; they all share the same state ────────
export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside <TourProvider>");
  return ctx;
}
