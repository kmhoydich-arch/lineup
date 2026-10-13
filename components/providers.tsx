"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { Units } from "@/lib/format";

const UNITS_KEY = "lineup-units";
const FAVORITES_KEY = "lineup-favorites";
const EMPTY: string[] = [];

const listeners = new Set<() => void>();
let unitsSnapshot: Units = "us";
let favoritesSnapshot: string[] = EMPTY;
let hydrated = false;

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return EMPTY;
    const ids = parsed.filter((item): item is string => typeof item === "string");
    return ids.length ? ids : EMPTY;
  } catch {
    return EMPTY;
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  const stored = localStorage.getItem(UNITS_KEY);
  unitsSnapshot = stored === "metric" ? "metric" : "us";
  favoritesSnapshot = readFavorites();
  hydrated = true;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = () => {
    hydrated = false;
    hydrate();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getUnits() {
  hydrate();
  return unitsSnapshot;
}

function getFavorites() {
  hydrate();
  return favoritesSnapshot;
}

function setUnits(next: Units) {
  unitsSnapshot = next;
  localStorage.setItem(UNITS_KEY, next);
  emit();
}

function toggleFavorite(id: string) {
  const current = getFavorites();
  favoritesSnapshot = current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id];
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesSnapshot));
  emit();
}

export function Providers({ children }: { children: ReactNode }) {
  return children;
}

export function useUnits() {
  const units = useSyncExternalStore(subscribe, getUnits, () => "us" as Units);
  return { units, setUnits };
}

export function useFavorites() {
  const ids = useSyncExternalStore(subscribe, getFavorites, () => EMPTY);
  return {
    ids,
    ready: true,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) => toggleFavorite(id),
  };
}
