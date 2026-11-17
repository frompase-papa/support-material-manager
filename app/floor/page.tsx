import { AuthProvider } from "@/app/components/AuthProvider";
import { FloorBoard } from "@/app/components/FloorBoard";

export default function FloorPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AuthProvider>
        <FloorBoard />
      </AuthProvider>
    </main>
  );
}
