/**
 * Native transport pricing adapter (Phase 0).
 *
 * Resolves a directed transport fare through Medusa's native Pricing Module
 * using exactly the context `origin_zone_id`, `destination_zone_id`,
 * `vehicle_variant_id`, and `currency_code`.
 *
 * Design notes:
 * - Prices are stored as-is (no cents conversion) and currency codes are
 *   lowercase, per the Medusa pricing contract.
 * - `pricing.calculatePrices` applies "partial match" preference ordering and
 *   silently returns a single "most relevant" price per price set. That is why
 *   ambiguity is detected here by an explicit, deterministic count over the
 *   persisted prices of the candidate price sets, independent of the native
 *   selection. The native call is still executed and its selection is reported
 *   so callers can detect a divergence.
 * - The requested currency is always filtered at the database level; there is
 *   no cross-currency fallback.
 */

import { MedusaError } from "@medusajs/framework/utils"

export type NativeTransportPriceContext = {
  origin_zone_id: string
  destination_zone_id: string
  vehicle_variant_id: string
  currency_code: string
}

/** Custom rule attributes that make a persisted price a directed transport fare. */
export const TRANSPORT_RULE_ATTRIBUTES = [
  "origin_zone_id",
  "destination_zone_id",
  "vehicle_variant_id",
] as const

export type NativeTransportPriceRuleReference = {
  price_set_id: string
  price_id: string
  price_list_id: string | null
  origin_zone_id: string
  destination_zone_id: string
  vehicle_variant_id: string
  currency_code: string
}

export type NativeTransportPrice = {
  amount: number
  currency_code: string
  rule: NativeTransportPriceRuleReference
  /** Native `calculatePrices` output for cross-checking the deterministic pick. */
  native: {
    selected_price_id: string | null
    calculated_amount: number | null
    agrees: boolean
  }
}

export type NativeTransportPriceResult =
  | { status: "priced"; price: NativeTransportPrice }
  | { status: "no_price"; reason: "no_matching_rule" }
  | {
      status: "ambiguous"
      reason: "equal_priority_matches"
      matches: NativeTransportPriceRuleReference[]
      native_selected_price_id: string | null
    }

export type NativePersistedPriceRule = {
  attribute: string
  value: string
  operator?: string | null
  deleted_at?: Date | string | null
}

export type NativePersistedPrice = {
  id: string
  price_set_id?: string | null
  currency_code?: string | null
  amount?: unknown
  deleted_at?: Date | string | null
  price_rules?: NativePersistedPriceRule[]
  price_list?: {
    id: string
    status?: string | null
    starts_at?: Date | string | null
    ends_at?: Date | string | null
  } | null
}

export type NativeCalculatedPriceSet = {
  id: string
  calculated_amount?: number | null
  currency_code?: string | null
  calculated_price?: {
    id?: string | null
    price_list_id?: string | null
  } | null
}

export type NativeTransportPricingAccess = {
  calculatePrices: (
    filters: { id: string[] },
    pricingContext: { context: Record<string, string> }
  ) => Promise<NativeCalculatedPriceSet[]>
  listPrices: (
    filters: { price_set_id: string[]; currency_code?: string },
    config?: { relations?: string[] }
  ) => Promise<NativePersistedPrice[]>
}

export type NativeTransportPriceRequest = {
  pricing: NativeTransportPricingAccess
  /** Candidate price sets, normally resolved from the vehicle variant link. */
  price_set_ids: string[]
  context: NativeTransportPriceContext
}

type QueryGraphAccess = {
  graph: (input: {
    entity: string
    fields: string[]
    filters: Record<string, unknown>
  }) => Promise<{ data: Array<Record<string, any>> }>
}

const REQUIRED_RULE_ATTRIBUTES = TRANSPORT_RULE_ATTRIBUTES

const assertValidContext = (context: NativeTransportPriceContext) => {
  for (const attribute of [
    "origin_zone_id",
    "destination_zone_id",
    "vehicle_variant_id",
    "currency_code",
  ] as const) {
    const value = context?.[attribute]

    if (typeof value !== "string" || value.trim().length === 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Transport pricing context requires a non-empty "${attribute}".`
      )
    }
  }
}

/**
 * Resolves the price sets linked to a product variant through the native
 * `product_variant_price_set` link.
 */
export const resolveVariantPriceSetIds = async (
  query: QueryGraphAccess,
  variantId: string
): Promise<string[]> => {
  if (!variantId) {
    return []
  }

  const { data } = await query.graph({
    entity: "product_variant",
    fields: ["id", "price_set.id"],
    filters: { id: variantId },
  })

  const variant = data?.[0]
  const priceSet = variant?.price_set

  if (!priceSet) {
    return []
  }

  const candidates = Array.isArray(priceSet) ? priceSet : [priceSet]

  return candidates
    .map((entry: { id?: string }) => entry?.id)
    .filter((id: string | undefined): id is string => Boolean(id))
}

const isPriceListActive = (
  priceList: NativePersistedPrice["price_list"],
  now: Date
): boolean => {
  if (!priceList) {
    return true
  }

  if (priceList.status && priceList.status !== "active") {
    return false
  }

  if (priceList.starts_at && new Date(priceList.starts_at) > now) {
    return false
  }

  if (priceList.ends_at && new Date(priceList.ends_at) < now) {
    return false
  }

  return true
}

/**
 * Returns the persisted prices of the candidate price sets that match the
 * transport context exactly, with their effective native priority.
 *
 * A price matches when every one of its rules is satisfied by the context and
 * all required transport attributes are present. Effective priority mirrors the
 * native preference ordering: a price governed by an active price list outranks
 * a plain price, and a price with more rules outranks a price with fewer.
 */
const collectMatches = (
  prices: NativePersistedPrice[],
  context: NativeTransportPriceContext,
  now: Date
) => {
  const currencyCode = context.currency_code.toLowerCase()
  const matched: Array<{
    reference: NativeTransportPriceRuleReference
    rulesCount: number
    hasPriceList: boolean
    amount: number
  }> = []

  for (const price of prices) {
    if (price.deleted_at) {
      continue
    }

    if ((price.currency_code ?? "").toLowerCase() !== currencyCode) {
      continue
    }

    if (!isPriceListActive(price.price_list, now)) {
      continue
    }

    const rules = (price.price_rules ?? []).filter((rule) => !rule.deleted_at)
    const matchesContext = rules.every((rule) => {
      const operator = rule.operator ?? "eq"

      if (operator !== "eq") {
        return false
      }

      return (context as Record<string, string>)[rule.attribute] === rule.value
    })

    if (!matchesContext) {
      continue
    }

    const hasAllRequiredRules = REQUIRED_RULE_ATTRIBUTES.every((attribute) =>
      rules.some(
        (rule) =>
          rule.attribute === attribute &&
          (rule.operator ?? "eq") === "eq" &&
          rule.value === (context as Record<string, string>)[attribute]
      )
    )

    if (!hasAllRequiredRules) {
      continue
    }

    matched.push({
      reference: {
        price_set_id: price.price_set_id ?? "",
        price_id: price.id,
        price_list_id: price.price_list?.id ?? null,
        origin_zone_id: context.origin_zone_id,
        destination_zone_id: context.destination_zone_id,
        vehicle_variant_id: context.vehicle_variant_id,
        currency_code: currencyCode,
      },
      rulesCount: rules.length,
      hasPriceList: Boolean(price.price_list?.id),
      amount: Number(price.amount),
    })
  }

  return matched
}

const priorityOf = (match: { hasPriceList: boolean; rulesCount: number }) =>
  `${match.hasPriceList ? 1 : 0}:${match.rulesCount}`

/**
 * Resolves a directed transport price through the native Pricing Module.
 *
 * Returns a discriminated union:
 * - `priced`: a single highest-priority match, with the rule references needed
 *   for a future immutable quote snapshot.
 * - `no_price`: no persisted rule matches the requested context (including the
 *   case where the requested currency has no rule — there is no fallback).
 * - `ambiguous`: two or more equal-context rules share the same effective
 *   priority, so no quoted price is returned.
 */
export const resolveNativeTransportPrice = async ({
  pricing,
  price_set_ids,
  context,
}: NativeTransportPriceRequest): Promise<NativeTransportPriceResult> => {
  assertValidContext(context)

  const currencyCode = context.currency_code.toLowerCase()
  const normalizedContext: NativeTransportPriceContext = {
    ...context,
    currency_code: currencyCode,
  }

  if (!price_set_ids?.length) {
    return { status: "no_price", reason: "no_matching_rule" }
  }

  const persisted = await pricing.listPrices(
    { price_set_id: price_set_ids, currency_code: currencyCode },
    { relations: ["price_rules", "price_list"] }
  )

  const matches = collectMatches(persisted, normalizedContext, new Date())

  // Native selection, kept for cross-checking only. It must never decide the
  // ambiguity outcome, because it silently prefers a "most relevant" price.
  const nativeResults = await pricing.calculatePrices(
    { id: price_set_ids },
    { context: { ...normalizedContext } }
  )

  if (!matches.length) {
    return { status: "no_price", reason: "no_matching_rule" }
  }

  const highestPriority = matches.reduce((best, match) => {
    const key = priorityOf(match)

    if (!best || key > best.key) {
      return { key, matches: [match] }
    }

    if (key === best.key) {
      best.matches.push(match)
    }

    return best
  }, undefined as undefined | { key: string; matches: typeof matches })

  const winners = highestPriority?.matches ?? []

  if (winners.length > 1) {
    const ambiguousNative = nativeResults.find((entry) =>
      price_set_ids.includes(entry.id)
    )

    return {
      status: "ambiguous",
      reason: "equal_priority_matches",
      matches: winners.map((match) => match.reference),
      native_selected_price_id:
        ambiguousNative?.calculated_price?.id ?? null,
    }
  }

  const selected = winners[0]
  const nativeForSelectedSet = nativeResults.find(
    (entry) => entry.id === selected.reference.price_set_id
  )
  const nativeSelectedPriceId = nativeForSelectedSet?.calculated_price?.id ?? null
  const nativeAmount =
    typeof nativeForSelectedSet?.calculated_amount === "number"
      ? nativeForSelectedSet.calculated_amount
      : null

  return {
    status: "priced",
    price: {
      amount: selected.amount,
      currency_code: currencyCode,
      rule: selected.reference,
      native: {
        selected_price_id: nativeSelectedPriceId,
        calculated_amount: nativeAmount,
        agrees: nativeSelectedPriceId === selected.reference.price_id,
      },
    },
  }
}
