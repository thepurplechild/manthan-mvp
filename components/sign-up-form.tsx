"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, User, Mail, Lock, Shield, FileText } from "lucide-react";

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
    console.log("Signup form submitted with:", { email, fullName, acceptedRights });
    
    const supabase = createClient();
    console.log("Supabase client created:", !!supabase);
    
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
      console.log("Attempting to sign up...");
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName,
          }
        },
      });
      
      console.log("Sign up result:", { error, user: data?.user?.id });
      
      if (error) throw error;
      
      console.log("Sign up successful, redirecting to dashboard");
      router.push("/dashboard");
    } catch (error: unknown) {
      console.error("Sign up error:", error);
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {/* Back button */}
      <Link 
        href="/" 
        className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to home
      </Link>
      
      {/* Signup Card */}
      <div className="relative bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl p-8 md:p-10">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 rounded-3xl"></div>
        
        <div className="relative">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-3">Join Manthan</h1>
            <p className="text-white/60 text-lg">
              Start your journey as a creator today
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignUp} className="space-y-6">
            {/* Full Name Field */}
            <div className="space-y-2">
              <Label htmlFor="full-name" className="text-white font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Full Name
              </Label>
              <Input
                id="full-name"
                type="text"
                placeholder="Your full name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-white/10 backdrop-blur-xl border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400/20 h-12 px-4 rounded-xl transition-all duration-300"
              />
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/10 backdrop-blur-xl border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400/20 h-12 px-4 rounded-xl transition-all duration-300"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white font-medium flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/10 backdrop-blur-xl border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400/20 h-12 px-4 rounded-xl transition-all duration-300"
              />
            </div>

            {/* Repeat Password Field */}
            <div className="space-y-2">
              <Label htmlFor="repeat-password" className="text-white font-medium flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Confirm Password
              </Label>
              <Input
                id="repeat-password"
                type="password"
                placeholder="••••••••"
                required
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                className="bg-white/10 backdrop-blur-xl border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400/20 h-12 px-4 rounded-xl transition-all duration-300"
              />
            </div>
              
            {/* Creator's Bill of Rights */}
            <div className="space-y-4 bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-2 text-purple-300">
                <Shield className="w-5 h-5" />
                <h3 className="font-semibold">Creator Protection</h3>
              </div>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    type="button" 
                    className="w-full bg-white/10 backdrop-blur-xl border-white/20 text-white hover:bg-white/20 hover:text-white rounded-xl h-12 transition-all duration-300"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Read Creator's Bill of Rights
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white/95 backdrop-blur-xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-purple-600" />
                      Creator's Bill of Rights
                    </DialogTitle>
                    <DialogDescription>
                      Please read and understand how your intellectual property will be handled
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <h4 className="font-semibold mb-2 text-purple-900">Your Rights as a Creator:</h4>
                      <ul className="space-y-2 text-gray-700">
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
              
              <div className="flex items-start space-x-3">
                <Checkbox 
                  id="rights-agreement"
                  checked={acceptedRights}
                  onCheckedChange={(checked) => setAcceptedRights(checked as boolean)}
                  className="mt-1 border-white/30 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                />
                <Label htmlFor="rights-agreement" className="text-sm leading-relaxed text-white/80 cursor-pointer">
                  I have read and agree to the Creator's Bill of Rights. I understand that my intellectual property will be protected and used only for generating my pitch materials.
                </Label>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 backdrop-blur-xl border border-red-500/20 text-red-300 p-4 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Signup Button */}
            <Button 
              type="submit" 
              disabled={isLoading || !acceptedRights}
              className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 backdrop-blur-sm border border-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/40 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creating your account...
                </div>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          {/* Login link */}
          <div className="text-center mt-8">
            <p className="text-white/60">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="text-purple-300 hover:text-purple-200 font-medium transition-colors"
              >
                Sign in instead
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
