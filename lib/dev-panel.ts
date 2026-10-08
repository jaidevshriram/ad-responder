"use client";

import { create } from "zustand";

export const useDevPanel = create<{ open: boolean; toggle: () => void; set: (open: boolean) => void }>(
  (set) => ({
    open: false,
    toggle: () => set((state) => ({ open: !state.open })),
    set: (open) => set({ open }),
  }),
);

/** True when a key press is meant for a text field, not a shortcut. */
export function isTyping(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  if (target instanceof HTMLInputElement)
    return !["range", "checkbox", "radio", "button"].includes(target.type);
  return target.tagName === "TEXTAREA" || target.isContentEditable;
}
