import { business } from "@/lib/business";
import {
  allBookableServices,
  getServicePriceEstimate,
} from "@/lib/services";
import type { CatalogChargeGroup, CatalogChargeItem } from "@/lib/charges/types";

export function catalogChargeGroups(weightLbs: number): CatalogChargeGroup[] {
  const services = allBookableServices();

  return business.serviceCategories
    .map((category) => {
      const items: CatalogChargeItem[] = [];
      for (const service of services.filter(
        (entry) => entry.categoryId === category.id,
      )) {
        if (service.options?.length) {
          for (const option of service.options) {
            const estimate = getServicePriceEstimate(
              service,
              weightLbs,
              option.name,
            );
            items.push({
              id: `${service.id}::${option.name}`,
              name: option.name,
              suggestedAmount: option.priceFrom ?? estimate?.from ?? null,
            });
          }
          continue;
        }

        items.push({
          id: service.id,
          name: service.name,
          suggestedAmount: getServicePriceEstimate(service, weightLbs)?.from ?? null,
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

export function catalogChargeItems(weightLbs: number): CatalogChargeItem[] {
  return catalogChargeGroups(weightLbs).flatMap((group) => group.items);
}
