import type { BookingPolicy } from "@/lib/services";

type Props = {
  policy: BookingPolicy;
  className?: string;
};

export function CreativeBookingPolicy({ policy, className = "" }: Props) {
  return (
    <div
      className={`rounded-2xl border border-lavender/30 bg-lavender-light/20 px-5 py-5 text-left ${className}`}
    >
      <h4 className="text-center text-base font-semibold text-gold-dark">
        {policy.title}
      </h4>
      <ol className="mt-4 list-decimal space-y-4 pl-5 text-sm text-text-muted">
        {policy.items.map((item) => (
          <li key={item.title}>
            <p className="font-medium text-text">{item.title}</p>
            <p className="mt-1 leading-relaxed">{item.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
