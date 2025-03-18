import { AuthForm } from "@/components/auth-form";

export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const message = params.message
    ? decodeURIComponent(params.message.toString())
    : null;

  return (
    <main className="min-h-dvh flex items-center justify-center flex-col gap-5 px-8 py-10 relative">
      <AuthForm
        nextUrl={params.next?.toString() || "/dashboard"}
        message={message}
      />
    </main>
  );
}
