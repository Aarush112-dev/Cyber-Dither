import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface WebGLFallbackProps {
  errorMessage: string;
}

export const WebGLFallback: React.FC<WebGLFallbackProps> = ({ errorMessage }) => {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#05050B] p-6">
      <div className="max-w-md rounded border border-[#FF3B9D]/40 bg-[#11111D] p-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded border border-[#FF3B9D]/40 bg-[#FF3B9D]/10 text-[#FF3B9D]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 className="font-display text-lg font-semibold text-[#F0F1FF]">
          3D WebGL Renderer Unavailable
        </h2>
        <p className="mt-2 text-sm text-[#8C91AE]">{errorMessage}</p>
        <p className="mt-3 text-xs text-[#8C91AE]">
          You can still browse the music library, upload local tracks, and control audio playback below.
        </p>
      </div>
    </div>
  );
};
