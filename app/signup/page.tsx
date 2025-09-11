import { SignUpForm } from "@/components/sign-up-form";

export const metadata = {
  title: "Sign Up • Manthan",
  description: "Create your Manthan account.",
};

export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 relative overflow-hidden">
      <div className="relative z-10 flex min-h-screen w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-lg">
          <SignUpForm />
        </div>
      </div>
    </div>
  );
}

