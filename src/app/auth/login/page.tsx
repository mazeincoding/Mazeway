import { Header } from "@/components/header";
import { AuthForm } from "@/components/auth-form";

export default function Login() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header isInitiallyLoggedIn={false} />
      <main className="flex-grow flex items-center justify-center flex-col gap-5 px-8 py-10 relative">
        <AuthForm type="login" />
      </main>
    </div>
  );
}
