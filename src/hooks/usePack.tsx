import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_PACK_ID = "00000000-0000-0000-0000-000000000002";

interface Pack {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  language_mode: string;
  pack_version: number;
  created_at: string;
  updated_at: string;
}

interface PackContextType {
  currentPack: Pack | null;
  currentPackId: string;
  setPack: (pack: Pack) => void;
  loading: boolean;
}

const PackContext = createContext<PackContextType>({
  currentPack: null,
  currentPackId: DEFAULT_PACK_ID,
  setPack: () => {},
  loading: true,
});

export function PackProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentPack, setCurrentPack] = useState<Pack | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCurrentPack(null);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);

      // Auto-enroll user in the default pack if not a member
      const { data: membership } = await supabase
        .from("pack_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("pack_id", DEFAULT_PACK_ID)
        .maybeSingle();

      if (!membership) {
        await supabase.from("pack_members").insert({
          user_id: user.id,
          pack_id: DEFAULT_PACK_ID,
          role: "learner",
        });
      }

      // Try to restore last selected pack from localStorage
      const savedPackId = localStorage.getItem("rocketboard_current_pack") || DEFAULT_PACK_ID;

      const { data: pack } = await supabase
        .from("packs")
        .select("*")
        .eq("id", savedPackId)
        .maybeSingle();

      if (pack) {
        setCurrentPack(pack as Pack);
      } else {
        // Fallback to default
        const { data: defaultPack } = await supabase
          .from("packs")
          .select("*")
          .eq("id", DEFAULT_PACK_ID)
          .maybeSingle();
        if (defaultPack) setCurrentPack(defaultPack as Pack);
      }

      setLoading(false);
    })();
  }, [user]);

  const setPack = (pack: Pack) => {
    setCurrentPack(pack);
    localStorage.setItem("rocketboard_current_pack", pack.id);
  };

  return (
    <PackContext.Provider
      value={{
        currentPack,
        currentPackId: currentPack?.id || DEFAULT_PACK_ID,
        setPack,
        loading,
      }}
    >
      {children}
    </PackContext.Provider>
  );
}

export function usePack() {
  return useContext(PackContext);
}
