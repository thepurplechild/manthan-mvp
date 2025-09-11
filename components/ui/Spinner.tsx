export default function Spinner({ size = 20 }: { size?: number }) {
  const s = `${size}px`
  return (
    <span role="status" aria-label="Loading" className="inline-block align-middle">
      <svg width={s} height={s} viewBox="0 0 24 24" className="animate-spin text-manthan-saffron-500">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </span>
  )
}

