import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cached: string | null = null;
let inflight: Promise<string | null> | null = null;

export const useMapboxToken = () => {
  const [token, setToken] = useState<string | null>(cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cached) return;
    if (!inflight) {
      inflight = supabase.functions
        .invoke("get-mapbox-token")
        .then(({ data, error }) => {
          if (error) throw error;
          const t = (data as { token?: string })?.token ?? null;
          if (t) cached = t;
          return t;
        })
        .catch((e) => {
          console.error("Failed to load Mapbox token", e);
          return null;
        });
    }
    inflight.then((t) => {
      if (t) setToken(t);
      else setError("Map unavailable");
    });
  }, []);

  return { token, error };
};
