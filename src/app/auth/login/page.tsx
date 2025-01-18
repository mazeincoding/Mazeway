import { AuthForm } from "@/components/auth-form";
import { BackButton } from "@/components/back-button";

export default function Login() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="p-4 pb-0">
        <BackButton />
      </div>
      <main className="flex-grow flex items-center justify-center flex-col gap-5 px-8 py-10 relative">
        <AuthForm type="login" />
      </main>
    </div>
  );
}
