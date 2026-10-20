"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void Promise.all([
        navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))),
        caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("afterglow-shell-")).map((name) => caches.delete(name)))),
      ]).then(() => {
        if (navigator.serviceWorker.controller && !window.sessionStorage.getItem("afterglow:dev-sw-cleared")) {
          window.sessionStorage.setItem("afterglow:dev-sw-cleared", "1");
          window.location.reload();
        }
      }).catch(() => {});
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
