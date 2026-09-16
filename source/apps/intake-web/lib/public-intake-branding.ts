export type PublicIntakeBranding = {
  realtorName?: string
  brandLine?: string
  brandColor?: string
  accentColor?: string
}

const SHOWREADY_DEFAULT_BRAND_NAME = "showready"

function cleanOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function isShowReadyBrandName(value: string | undefined) {
  return value?.toLowerCase() === SHOWREADY_DEFAULT_BRAND_NAME
}

export function buildPublicIntakeBranding({
  fullName,
  brokerage,
  brandName,
  brandColor,
  accentColor
}: {
  fullName?: string | null
  brokerage?: string | null
  brandName?: string | null
  brandColor?: string | null
  accentColor?: string | null
}): PublicIntakeBranding {
  const normalizedBrandName = cleanOptionalText(brandName)
  const fallbackBrandLine =
    normalizedBrandName && !isShowReadyBrandName(normalizedBrandName)
      ? normalizedBrandName
      : undefined

  return {
    realtorName: cleanOptionalText(fullName),
    brandLine: cleanOptionalText(brokerage) ?? fallbackBrandLine,
    brandColor: cleanOptionalText(brandColor),
    accentColor: cleanOptionalText(accentColor)
  }
}
