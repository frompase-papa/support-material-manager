import { AuthProvider } from "@/app/components/AuthProvider";
import { StudyDashboard } from "@/app/components/StudyDashboard";

export default function StudyPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AuthProvider>
        <StudyDashboard />
      </AuthProvider>
    </main>
  );
}
