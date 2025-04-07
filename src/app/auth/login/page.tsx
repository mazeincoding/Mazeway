import { AuthForm } from "@/components/auth-form";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const email = params.email
    ? decodeURIComponent(params.email.toString())
    : null;

  // Parse the available methods from the URL
  const initialMethods = params.available_methods
    ? JSON.parse(decodeURIComponent(params.available_methods.toString()))
    : [];

  return (
    <main className="min-h-dvh flex items-center justify-center flex-col gap-5 px-8 py-10 relative">
      <AuthForm
        requires2fa={params.requires_2fa === "true"}
        nextUrl={params.next?.toString() || "/dashboard"}
        initialMethods={initialMethods}
        initialEmail={email}
      />
    </main>
  );
}
