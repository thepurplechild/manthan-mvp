export default function Loading() {
  return (
    <div className="container mx-auto px-6 py-10">
      <div className="animate-pulse h-8 w-64 bg-white/10 rounded mb-6" />
      <div className="grid md:grid-cols-4 gap-6 mb-12">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-white/10 rounded-xl" />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 bg-white/10 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

