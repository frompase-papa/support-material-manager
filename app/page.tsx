import { AuthProvider } from "@/app/components/AuthProvider";
import AttendanceCalendar from "@/app/components/AttendanceCalendar";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AuthProvider>
        <AttendanceCalendar />
      </AuthProvider>
    </main>
  );
}
