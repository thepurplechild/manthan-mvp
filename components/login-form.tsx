"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Mail, Lock } from "lucide-react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Login form submitted with:", { email, password: "***" });
    
    const supabase = createClient();
    console.log("Supabase client created:", !!supabase);
    
    setIsLoading(true);
    setError(null);

    try {
      console.log("Attempting to sign in...");
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      console.log("Sign in result:", { error, user: data?.user?.id });
      
      if (error) throw error;
      
      console.log("Sign in successful, redirecting to dashboard");
      router.push("/dashboard");
    } catch (error: unknown) {
      console.error("Sign in error:", error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      
      // Provide better guidance for common issues
      if (errorMessage.includes("Email not confirmed") || errorMessage.includes("email_not_confirmed")) {
        setError("Please check your email and click the confirmation link before signing in. Check your spam folder if you don't see the email.");
      } else if (errorMessage.includes("Invalid login credentials")) {
        setError("Invalid email or password. If you just signed up, make sure you've confirmed your email first.");
      } else {
        setError(errorMessage);
      }
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
      
      {/* Login Card */}
      <div className="relative bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl p-8 md:p-10">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 rounded-3xl"></div>
        
        <div className="relative">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-3">Welcome Back</h1>
            <p className="text-white/60 text-lg">
              Sign in to continue your creative journey
            </p>
          </div>

          {/* Info Banner for New Users */}
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-blue-100 text-sm text-center">
              <span className="font-medium">New to Manthan?</span> After signing up, check your email for a confirmation link before signing in.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </Label>
              <div className="relative">
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
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-white font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-purple-300 hover:text-purple-200 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
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
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 backdrop-blur-xl border border-red-500/20 text-red-300 p-4 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Login Button */}
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 backdrop-blur-sm border border-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/40 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Signing in...
                </div>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Sign up link */}
          <div className="text-center mt-8">
            <p className="text-white/60">
              Don't have an account?{" "}
              <Link
                href="/auth/sign-up"
                className="text-purple-300 hover:text-purple-200 font-medium transition-colors"
              >
                Create one now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
