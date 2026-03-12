import { useState, useCallback, useEffect, useRef } from "react";
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

// Shared mutable store so all hook instances share the same activeTourId
// This avoids needing React Context while still achieving cross-component coordination
let _activeTourId: string | null = null;
const _listeners = new Set<() => void>();

function setSharedTourId(id: string | null) {
  _activeTourId = id;
  _listeners.forEach((fn) => fn());
}

export function useTour() {
  const location = useLocation();
  const { packAccessLevel } = useRole();
  const [, forceUpdate] = useState(0);
  const lastTourTime = useRef(0);
  const mountTime = useRef(Date.now());

  // Subscribe to shared store changes
  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  const shouldShowTour = useCallback((tourId: string): boolean => {
    const completed = getCompletedTours();
    return !completed[tourId];
  }, []);

  const completeTour = useCallback((tourId: string) => {
    const completed = getCompletedTours();
    completed[tourId] = Date.now();
    saveCompletedTours(completed);
    lastTourTime.current = Date.now();
    setSharedTourId(null);
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
    setSharedTourId(tourId);
  }, []);

  // Auto-trigger tour on page visit
  useEffect(() => {
    mountTime.current = Date.now();
    const timer = setTimeout(() => {
      const elapsed = Date.now() - mountTime.current;
      if (elapsed < 1800) return;
      if (Date.now() - lastTourTime.current < 5000) return;
      if (location.pathname.includes("/onboarding")) return;
      if (_activeTourId) return; // don't clobber a manually started tour

      const tour = getCurrentPageTour();
      if (tour && shouldShowTour(tour.id)) {
        setSharedTourId(tour.id);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [location.pathname, getCurrentPageTour, shouldShowTour]);

  const activeTourId = _activeTourId;
  const activeTour = activeTourId
    ? ALL_TOURS.find((t) => t.id === activeTourId) || null
    : null;

  return {
    activeTour,
    activeTourId,
    shouldShowTour,
    completeTour,
    resetTour,
    resetAllTours,
    startTour,
    getCurrentPageTour,
    setActiveTourId: setSharedTourId,
  };
}
