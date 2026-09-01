"use client";

import { useEffect, useRef } from "react";
import { account } from "@/lib/core/account";
import { util } from "@/lib/core/util";
import DirectMachConn from "@/lib/core/direct-mach-conn";
import { useAccountStore } from "@/lib/core/stores";

export function AppInitializer() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Try to auto-login based on stored credentials
    account.try_login().catch((err) => {
      console.log("Auto-login note:", err);
    }).finally(() => {
      useAccountStore.getState().setInitializing(false);
    });

    // Initialize direct machine connection to local folding client
    try {
      let addr = util.get_direct_address();
      new DirectMachConn('local', addr);
    } catch (err) {
      console.log("Direct connection init failed:", err);
    }
  }, []);

  return null;
}
