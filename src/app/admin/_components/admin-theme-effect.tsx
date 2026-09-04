"use client";

import { useEffect } from "react";

export default function AdminThemeEffect() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, []);

  return null;
}
