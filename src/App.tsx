import { useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import Index from "./pages/Index";
import { Toaster } from "./components/ui/sonner";

// Lazy-load secondary routes for code splitting
const WatchPreview = lazy(() => import("./pages/WatchPreview"));
const NotFound = lazy(() => import("./pages/NotFound"));

const App = () => {
  useEffect(() => {
    // Add platform-specific class for CSS targeting (fixes Android scaling)
    if (Capacitor.getPlatform() === "android") {
      console.log("Applying Android-specific CSS class");
      document.documentElement.classList.add("is-android");
    }
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen" />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/watch" element={<WatchPreview />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toaster position="top-center" />
    </BrowserRouter>
  );
};

export default App;
