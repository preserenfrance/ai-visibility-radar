import { Loader2 } from "lucide-react";

export default function AppLoading() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-7xl items-center px-5 py-8">
      <div className="flex items-center gap-3 rounded-md border bg-white px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Nalagam pogled...
      </div>
    </main>
  );
}
