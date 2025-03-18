import { AuthForm } from "@/components/auth-form";

export default function Signup({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  return (
    <main className="min-h-dvh flex items-center justify-center flex-col gap-5 px-8 py-10 relative">
      <AuthForm
        nextUrl={searchParams.next || "/dashboard"}
        message={searchParams.message || null}
      />
    </main>
  );
}
