import { Header } from "@/components/header";

export default function Dashboard() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header isInitiallyLoggedIn />
      <main className="flex-1 container max-w-7xl mx-auto py-8 px-4 gap-2 flex flex-col">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-lg text-muted-foreground">
          This is the dashboard. Do whatever you need here!
        </p>
      </main>
    </div>
  );
}
