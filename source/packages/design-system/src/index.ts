export const showReadyTokens = {
  colors: {
    bone: "#f6f1e7",
    boneRaised: "#fffaf2",
    ink: "#171717",
    inkMuted: "#5c574f",
    inkSoft: "#7a7367",
    cypress: "#1f5f57",
    cypressSoft: "#d7ece8",
    amberRed: "#b74d2c",
    amberRedSoft: "#f6e4dd",
    border: "#ded3c5",
    success: "#2f7d5a",
    successSoft: "#dcefe5",
    warning: "#9a5a13",
    warningSoft: "#f8e7d1",
    neutral: "#6b7280",
    neutralSoft: "#eceff3",
    danger: "#b3261e",
    dangerSoft: "#fde7e5"
  },
  radii: {
    card: 26,
    pill: 999
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32
  },
  shadows: {
    soft: "0 18px 40px rgba(23, 23, 23, 0.08)",
    crisp: "0 10px 24px rgba(31, 95, 87, 0.14)"
  },
  fonts: {
    display: "\"Iowan Old Style\", \"Palatino Linotype\", Georgia, serif",
    body: "\"Avenir Next\", \"Segoe UI\", sans-serif",
    mono: "\"SFMono-Regular\", \"JetBrains Mono\", monospace"
  }
} as const

export const mobileTheme = {
  colors: {
    background: "#fffefd",
    surface: "#ffffff",
    surfaceStrong: "#f5f1ff",
    surfaceMuted: "#faf9ff",
    surfaceTint: "#f1edff",
    ink: "#0d1324",
    mutedInk: "#5c6272",
    subtleInk: "#808696",
    border: "#ebe7f2",
    borderStrong: "#ddd6eb",
    brand: "#6f3ff5",
    brandStrong: "#5d35d8",
    brandAlt: "#e43fa3",
    accent: "#ff7a2d",
    focus: "#c6b7ff",
    ready: "#1f8a65",
    readySoft: "#e5f3eb",
    appointment: "#6f3ff5",
    appointmentSoft: "#f0ebff",
    nurture: "#d95a1d",
    nurtureSoft: "#fff0e7",
    hold: "#666a73",
    holdSoft: "#eeeeef",
    won: "#247244",
    wonSoft: "#e6f3ea",
    lost: "#b3261e",
    lostSoft: "#fbe7e4",
    archived: "#666a73",
    archivedSoft: "#eeeeef",
    inverse: "#ffffff",
    scrim: "rgba(23, 27, 38, 0.42)"
  },
  radii: {
    ...showReadyTokens.radii,
    control: 22,
    sheet: 32
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32
  },
  typography: {
    eyebrow: 12,
    body: 17,
    bodySmall: 15,
    title: 34,
    section: 28
  },
  gradients: {
    primary: ["#6f3ff5", "#d940b1", "#ff8a2a"],
    primarySoft: ["#f3efff", "#fff0f8", "#fff2e5"],
    tab: ["#6f3ff5", "#d940b1", "#ff8a2a"]
  },
  elevation: {
    card: {
      shadowColor: "#171b26",
      shadowOpacity: 0.08,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 3
    },
    floating: {
      shadowColor: "#171b26",
      shadowOpacity: 0.14,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 14 },
      elevation: 8
    }
  }
} as const

export function buildWebCssVariables() {
  return `
    :root {
      --sr-bone: ${showReadyTokens.colors.bone};
      --sr-bone-raised: ${showReadyTokens.colors.boneRaised};
      --sr-ink: ${showReadyTokens.colors.ink};
      --sr-ink-muted: ${showReadyTokens.colors.inkMuted};
      --sr-ink-soft: ${showReadyTokens.colors.inkSoft};
      --sr-cypress: ${showReadyTokens.colors.cypress};
      --sr-cypress-soft: ${showReadyTokens.colors.cypressSoft};
      --sr-amber-red: ${showReadyTokens.colors.amberRed};
      --sr-amber-red-soft: ${showReadyTokens.colors.amberRedSoft};
      --sr-border: ${showReadyTokens.colors.border};
      --sr-font-display: ${showReadyTokens.fonts.display};
      --sr-font-body: ${showReadyTokens.fonts.body};
      --sr-font-mono: ${showReadyTokens.fonts.mono};
      --sr-shadow-soft: ${showReadyTokens.shadows.soft};
      --sr-shadow-crisp: ${showReadyTokens.shadows.crisp};
    }
  `
}
