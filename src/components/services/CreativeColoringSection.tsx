import type { BookableService } from "@/lib/services";
import { coloringOptionPriceLabel } from "@/lib/service-page";
import { PolicyAccordion } from "@/components/services/PolicyAccordion";

type Props = {
  service: BookableService;
};

export function CreativeColoringSection({ service }: Props) {
  const options = service.options ?? [];
  const policy = service.bookingPolicy;

  return (
    <div>
      {service.note && (
        <p className="font-body mx-auto mb-8 max-w-2xl text-center text-sm text-taupe">
          {service.note}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {options.map((option) => (
          <article
            key={option.name}
            className="border border-gray-line/80 bg-ivory p-5"
          >
            <h3 className="font-display text-xl text-ink">{option.name}</h3>
            {option.description && (
              <p className="font-body mt-2 text-sm leading-relaxed text-taupe">
                {option.description}
              </p>
            )}
            <p className="font-body mt-4 text-sm text-ink">
              {coloringOptionPriceLabel(option)}
            </p>
          </article>
        ))}
      </div>

      {policy && (
        <div className="mt-8">
          <PolicyAccordion
            title="Creative Coloring Policies"
            summary="Consultation, coat condition, fade expectations, and booking requirements."
          >
            <p className="font-body mb-5 text-sm leading-relaxed text-taupe">
              {service.description}
            </p>
            <ol className="list-decimal space-y-4 pl-5 text-sm text-taupe">
              {policy.items.map((item) => (
                <li key={item.title}>
                  <p className="font-medium text-ink">{item.title}</p>
                  <p className="mt-1 leading-relaxed">{item.body}</p>
                </li>
              ))}
            </ol>
          </PolicyAccordion>
        </div>
      )}
    </div>
  );
}
