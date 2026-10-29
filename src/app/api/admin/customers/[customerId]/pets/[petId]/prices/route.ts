import { NextResponse } from "next/server";
import { validatePetId } from "@/lib/pets/validation";
import { validateCustomerId, ProfileValidationError } from "@/lib/profiles/validation";
import { handlePetRouteError, jsonError } from "@/lib/pets/errors";
import { mapStaffServiceError } from "@/lib/staff/api-errors";
import { saveStaffPetServicePrice } from "@/lib/pets/fixed-price-service";

export async function PUT(request: Request, context: {params:Promise<{customerId:string;petId:string}>}) {
  try {
    const params=await context.params;
    const customerId=validateCustomerId(params.customerId);
    const petId=validatePetId(params.petId);
    const body=await request.json().catch(()=>null);
    const result=await saveStaffPetServicePrice(customerId,petId,body);
    if ("error" in result) {
      if (result.error === "invalid") return jsonError("Choose a service and enter a price from $0 to $5,000, with at most two decimal places.",400);
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json(result);
  } catch(error) {
    if(error instanceof ProfileValidationError) return jsonError(error.message,400,error.field);
    return handlePetRouteError(error);
  }
}
