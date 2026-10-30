import { NextResponse } from "next/server";
import { deleteOwnServiceAddress, listOwnServiceAddresses, saveOwnServiceAddress } from "@/lib/profiles/customer-addresses";
import { parseServiceAddressInput, ProfileValidationError, validateCustomerId } from "@/lib/profiles/validation";
import { mapStaffServiceError } from "@/lib/staff/api-errors";
import { jsonError } from "@/lib/pets/errors";

export async function GET() {
  const result = await listOwnServiceAddresses();
  return "error" in result ? mapStaffServiceError(result.error) : NextResponse.json(result);
}

async function write(request: Request, editing: boolean) {
  try {
    const body = await request.json();
    const address = parseServiceAddressInput(body);
    const id = editing ? validateCustomerId(body.id) : undefined;
    const result = await saveOwnServiceAddress(address, id);
    if ("error" in result) {
      return result.error === "conflict"
        ? jsonError("This address is already in your address book.", 409)
        : mapStaffServiceError(result.error);
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProfileValidationError) return jsonError(error.message, 400, error.field);
    if (error instanceof SyntaxError) return jsonError("Invalid request body.", 400);
    console.error("Address book save failed", error);
    return jsonError("Could not save your address. Please try again.", 500);
  }
}

export async function POST(request: Request) { return write(request, false); }
export async function PATCH(request: Request) { return write(request, true); }

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const id = validateCustomerId(body?.id);
    const result = await deleteOwnServiceAddress(id);
    return "error" in result ? mapStaffServiceError(result.error) : NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProfileValidationError) return jsonError(error.message, 400, error.field);
    if (error instanceof SyntaxError) return jsonError("Invalid request body.", 400);
    console.error("Address book delete failed", error);
    return jsonError("Could not delete this address. Please try again.", 500);
  }
}
