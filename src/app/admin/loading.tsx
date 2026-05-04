import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-[#0B2447]">
        <Loader2 className="h-10 w-10 animate-spin text-[#C9A520]" />
        <p className="text-sm font-medium">A carregar...</p>
      </div>
    </div>
  );
}
