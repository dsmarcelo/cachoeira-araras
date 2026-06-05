"use client";

import { useEffect } from "react";

import { storeGclidCookie } from "@/lib/gclid";

export default function GclidCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    storeGclidCookie(params.get("gclid"));
  }, []);

  return null;
}
