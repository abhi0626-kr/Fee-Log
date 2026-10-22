import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      <span className="text-xs font-semibold">Loading...</span>
    </div>
  );
}
