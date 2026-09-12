import { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

export const requireAdminActor = (req: AuthenticatedMedusaRequest) => {
  const actorId = req.auth_context?.actor_id

  if (!actorId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Admin authentication is required")
  }

  return actorId
}

export const requiredString = (value: unknown, field: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `${field} is required`)
  }

  return value.trim()
}

export const optionalBoolean = (value: unknown, fallback: boolean) => {
  if (value === undefined) {
    return fallback
  }

  if (typeof value !== "boolean") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "active must be a boolean")
  }

  return value
}

export const requiredAmount = (value: unknown) => {
  if (typeof value !== "number" || value <= 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "amount must be a positive number")
  }

  return value
}

export const reservationStatus = (value: unknown) => {
  if (value !== "confirmed" && value !== "cancelled") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "status must be confirmed or cancelled")
  }

  return value
}
