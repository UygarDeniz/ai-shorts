import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export async function AuthNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const signOut = async () => {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    return redirect("/login");
  };

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{user.email}</span>
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit">
            Logout
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link
        href="/login"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Login
      </Link>
      <Link
        href="/signup"
        className="text-sm font-medium text-primary hover:underline hover:text-primary/80"
      >
        Sign up
      </Link>
    </div>
  );
}
