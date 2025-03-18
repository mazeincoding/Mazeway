import { AuthForm } from "@/components/auth-form";

export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-dvh flex items-center justify-center flex-col gap-5 px-8 py-10 relative">
      <AuthForm
        nextUrl={params.next?.toString() || "/dashboard"}
        message={params.message?.toString() || null}
      />
    </main>
  );
}
