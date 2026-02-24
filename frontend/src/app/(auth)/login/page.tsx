import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>;
}) {
  const { message } = await searchParams;

  const signIn = async (formData: FormData) => {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return redirect(
        "/login?message=Could not authenticate user: " + error.message,
      );
    }
    return redirect("/dashboard");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background relative px-4">
      {/* Background Blurs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      <Link
        href="/"
        className="absolute left-8 top-8 py-2 px-4 rounded-full border border-border/50 text-muted-foreground bg-background/50 backdrop-blur-md hover:bg-muted hover:text-foreground transition-colors flex items-center group text-sm font-medium z-10"
      >
        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back
      </Link>

      <div className="w-full max-w-md p-8 space-y-8 bg-card border border-border/50 rounded-2xl shadow-2xl shadow-black/50 z-10 backdrop-blur-xl animate-fade-in-up">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your account to continue
          </p>
        </div>

        <form className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                className="text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                htmlFor="email"
              >
                Email
              </label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors hover:border-border/80"
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                htmlFor="password"
              >
                Password
              </label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors hover:border-border/80"
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            formAction={signIn}
            className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-4 py-2"
          >
            Sign In
          </button>

          {message && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive border border-destructive/20 text-center font-medium animate-in fade-in slide-in-from-bottom-1">
              {message}
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground pt-2">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-primary hover:text-primary/80 transition-colors underline-offset-4 hover:underline"
            >
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
