"use client";

import { useState, useEffect } from "react";
import { useUIStore } from "@/lib/core/stores";
import DirectMachConn from "@/lib/core/direct-mach-conn";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConnectDialog() {
  const { isConnectOpen, setConnectOpen } = useUIStore();
  const [address, setAddress] = useState("");
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    setIsValid(/^[\w-]+(\.[\w-]+)*(:\d+)?$/.test(address));
  }, [address]);

  const handleConnect = () => {
    if (!isValid) return;
    
    // In legacy, this used `$direct.address` - DirectMachConn was instantiated with this.
    // We instantiate or update DirectMachConn here
    new DirectMachConn('direct', address);
    
    setConnectOpen(false);
  };

  return (
    <Dialog open={isConnectOpen} onOpenChange={setConnectOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Connect to Client</DialogTitle>
          <DialogDescription>
            Connect directly to a local or remote Folding@home client by its IP address or hostname.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="address" className="text-right">
              Address
            </Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="127.0.0.1:7396"
              className="col-span-3"
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setConnectOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={!isValid}>
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
