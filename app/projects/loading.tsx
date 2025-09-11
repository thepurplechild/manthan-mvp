export default function Loading() {
  return (
    <div className="container mx-auto px-6 py-10">
      <div className="animate-pulse h-6 w-48 bg-black/10 rounded mb-4" />
      <div className="space-y-2">
        <div className="h-24 bg-black/10 rounded" />
        <div className="h-24 bg-black/10 rounded" />
      </div>
    </div>
  );
}

