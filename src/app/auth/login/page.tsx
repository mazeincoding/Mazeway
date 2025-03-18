import { AuthForm } from "@/components/auth-form";

export default function Login({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  return (
    <main className="min-h-dvh flex items-center justify-center flex-col gap-5 px-8 py-10 relative">
      <AuthForm
        requires2fa={searchParams.requires_2fa === "true"}
        initialFactorId={searchParams.factor_id || null}
        nextUrl={searchParams.next || "/dashboard"}
        initialMethods={
          searchParams.available_methods
            ? JSON.parse(searchParams.available_methods)
            : []
        }
        message={searchParams.message || null}
      />
    </main>
  );
}
