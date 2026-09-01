"use client";

import { useState } from "react";
import { useUIStore } from "@/lib/core/stores";
import { account } from "@/lib/core/account";
import { cryptoUtil as crypto } from "@/lib/core/crypto";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, RefreshCw, Copy, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginDialog() {
  const { isLoginOpen, setLoginOpen } = useUIStore();
  
  const [email, setEmail] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const validate = () => {
    const newErrors: string[] = [];
    
    if (!email) {
      newErrors.push("A valid email address is required");
    } else if (!/.{1,64}@.{4,255}/.test(email)) {
      newErrors.push("Invalid email address");
    }

    if (passphrase.length < 10) {
      newErrors.push("Your passphrase must be at least 10 characters long");
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleAction = async () => {
    if (!validate()) return;
    
    setIsSubmitting(true);
    try {
      await account.login_with_passphrase({ email, passphrase });
      setLoginOpen(false);
    } catch (e: any) {
      let errorMsg = "An unknown error occurred";
      if (typeof e === "string") {
        errorMsg = e;
      } else if (e && typeof e === "object") {
        errorMsg = e.error || e.message || e.toString();
      }
      
      // Clean up technical database error prefixes like "DB:1644: "
      errorMsg = errorMsg.replace(/^DB:\d+:\s*/, "");
      
      setErrors([errorMsg]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isLoginOpen} onOpenChange={setLoginOpen}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Login to Folding@home</DialogTitle>
          <DialogDescription>
            Enter your email and passphrase to access your account.
          </DialogDescription>
        </DialogHeader>

        {errors.length > 0 && (
          <div className="space-y-2 mt-2">
            {errors.map((error, i) => (
              <Alert variant="destructive" key={i} className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
            <Input 
              id="email" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="address@example.com"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="passphrase">Passphrase <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input 
                id="passphrase" 
                type={showPassphrase ? "text" : "password"} 
                value={passphrase} 
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAction()}
                disabled={isSubmitting}
              />
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground" 
                onClick={() => setShowPassphrase(!showPassphrase)}
                disabled={isSubmitting}
              >
                {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setLoginOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleAction} disabled={isSubmitting}>
            {isSubmitting ? "Signing In..." : "Sign In"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
