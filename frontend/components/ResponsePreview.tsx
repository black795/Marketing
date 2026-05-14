import type { GenerateStoryResponse } from '@/types/story';

interface ResponsePreviewProps {
  data: GenerateStoryResponse | null;
}

export default function ResponsePreview({ data }: ResponsePreviewProps) {
  if (!data) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-sm text-neutral-400">
        La respuesta aparecerá aquí
      </div>
    );
  }

  return (
    <pre className="h-full min-h-[300px] overflow-auto rounded-md border border-neutral-200 bg-neutral-900 p-4 text-xs leading-relaxed text-green-200">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
