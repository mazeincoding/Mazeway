import { AuthForm } from "@/components/auth-form";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-dvh flex items-center justify-center flex-col gap-5 px-8 py-10 relative">
      <AuthForm
        requires2fa={params.requires_2fa === "true"}
        initialFactorId={params.factor_id?.toString() || null}
        nextUrl={params.next?.toString() || "/dashboard"}
        initialMethods={
          params.available_methods
            ? JSON.parse(params.available_methods.toString())
            : []
        }
        message={params.message?.toString() || null}
      />
    </main>
  );
}
