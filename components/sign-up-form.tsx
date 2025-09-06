"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [acceptedRights, setAcceptedRights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (!acceptedRights) {
      setError("You must accept the Creator's Bill of Rights to continue");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName,
          }
        },
      });
      if (error) throw error;
      router.push("/dashboard");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign up</CardTitle>
          <CardDescription>Create a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="full-name">Full Name</Label>
                <Input
                  id="full-name"
                  type="text"
                  placeholder="Your full name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="repeat-password">Repeat Password</Label>
                </div>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
              
              {/* Creator's Bill of Rights */}
              <div className="grid gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" type="button" className="w-full">
                      Read Creator's Bill of Rights
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Creator's Bill of Rights</DialogTitle>
                      <DialogDescription>
                        Please read and understand how your intellectual property will be handled
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 text-sm">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">Your Rights as a Creator:</h4>
                        <ul className="space-y-2">
                          <li>• I understand my uploaded script will be used only for the purpose of generating my project's pitch materials.</li>
                          <li>• I understand my script and personal data will never be shared with third parties without my explicit, case-by-case permission.</li>
                          <li>• I understand my intellectual property will not be used to train any public or third-party AI models.</li>
                          <li>• I retain full ownership of my creative work and all intellectual property rights.</li>
                          <li>• I can request deletion of my data and scripts at any time.</li>
                        </ul>
                      </div>
                      <p className="text-gray-600">
                        Manthan is committed to protecting creator rights and building a platform based on trust and transparency.
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="rights-agreement"
                    checked={acceptedRights}
                    onCheckedChange={(checked) => setAcceptedRights(checked as boolean)}
                  />
                  <Label htmlFor="rights-agreement" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    I have read and agree to the Creator's Bill of Rights
                  </Label>
                </div>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading || !acceptedRights}>
                {isLoading ? "Creating an account..." : "Sign up"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
