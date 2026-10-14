import { business } from "@/lib/business";
import { bookingWeightLbs } from "@/lib/pets/weight";
import {
  allBookableServices,
  getServicePriceEstimate,
} from "@/lib/services";
import type { CatalogChargeGroup, CatalogChargeItem } from "@/lib/charges/types";

export function catalogChargeGroups(weightLbs: number | null): CatalogChargeGroup[] {
  const pricedWeight = bookingWeightLbs(weightLbs);
  const services = allBookableServices();

  return business.serviceCategories
    .map((category) => {
      const items: CatalogChargeItem[] = [];
      for (const service of services.filter(
        (entry) => entry.categoryId === category.id,
      )) {
        if (service.options?.length) {
          for (const option of service.options) {
            const estimate =
              pricedWeight == null
                ? null
                : getServicePriceEstimate(service, pricedWeight, option.name);
            items.push({
              id: `${service.id}::${option.name}`,
              name: option.name,
              suggestedAmount:
                pricedWeight == null
                  ? null
                  : (option.priceFrom ?? estimate?.from ?? null),
            });
          }
          continue;
        }

        items.push({
          id: service.id,
          name: service.name,
          suggestedAmount:
            pricedWeight == null
              ? null
              : (getServicePriceEstimate(service, pricedWeight)?.from ?? null),
        });
      }
      return {
        id: category.id,
        name: category.name,
        items,
      };
    })
    .filter((group) => group.items.length > 0);
}

export function catalogChargeItems(weightLbs: number | null): CatalogChargeItem[] {
  return catalogChargeGroups(weightLbs).flatMap((group) => group.items);
}
