function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`size-3.5 ${filled ? "fill-gold" : "fill-gray-line"}`}
    >
      <path d="M10 1.6 12.4 7l5.9.5-4.5 3.8 1.4 5.7L10 13.8 4.8 17l1.4-5.7L1.7 7.5 7.6 7 10 1.6Z" />
    </svg>
  );
}

export function StarRating({ rating }: { rating: number }) {
  const value = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <p className="flex gap-1" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} filled={index < value} />
      ))}
    </p>
  );
}
