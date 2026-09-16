const fs = require("node:fs")
const path = require("node:path")
const sharp = require("sharp")

const WIDTH = 1290
const HEIGHT = 2796
const PHONE = {
  x: 136,
  y: 594,
  w: 1018,
  h: 2106,
  r: 76,
  inset: 34
}
const SCREEN = {
  x: PHONE.x + PHONE.inset,
  y: PHONE.y + PHONE.inset + 22,
  w: PHONE.w - PHONE.inset * 2,
  h: PHONE.h - PHONE.inset * 2 - 34,
  r: 52
}

const theme = {
  background: "#fffefd",
  surface: "#ffffff",
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
  ready: "#1f8a65",
  readySoft: "#e5f3eb",
  appointment: "#6f3ff5",
  appointmentSoft: "#f0ebff",
  nurture: "#d95a1d",
  nurtureSoft: "#fff0e7",
  hold: "#666a73",
  holdSoft: "#eeeeef",
  lost: "#b3261e",
  lostSoft: "#fbe7e4"
}

const font = "-apple-system, BlinkMacSystemFont, 'Avenir Next', Arial, sans-serif"
const outputDir = path.join(__dirname, "..", "app-store-assets", "ios-6.9")
const iconPath = path.join(__dirname, "..", "assets", "app-icon.png")
const iconData = fs.readFileSync(iconPath).toString("base64")

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function wrap(value, maxChars) {
  const words = String(value).split(/\s+/)
  const lines = []
  let current = ""

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

function text({
  x,
  y,
  value,
  size = 32,
  weight = 500,
  color = theme.ink,
  width,
  lineHeight,
  anchor = "start",
  opacity = 1,
  caps = false
}) {
  const lines = width ? wrap(value, Math.max(8, Math.floor(width / (size * 0.55)))) : [value]
  const actualLineHeight = lineHeight ?? Math.round(size * 1.18)
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : actualLineHeight
      return `<tspan x="${x}" dy="${dy}">${esc(caps ? line.toUpperCase() : line)}</tspan>`
    })
    .join("")

  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}" opacity="${opacity}" letter-spacing="0">${tspans}</text>`
}

function rect({ x, y, w, h, r = 0, fill = theme.surface, stroke, sw = 1, opacity = 1, filter }) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" opacity="${opacity}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ""}${filter ? ` filter="${filter}"` : ""}/>`
}

function circle({ cx, cy, r, fill, stroke, sw = 1, opacity = 1 }) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ""}/>`
}

function line({ x1, y1, x2, y2, color = theme.border, sw = 2, opacity = 1 }) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${sw}" opacity="${opacity}" stroke-linecap="round"/>`
}

function checkIcon(cx, cy, color) {
  return `<path d="M${cx - 12} ${cy} L${cx - 3} ${cy + 10} L${cx + 14} ${cy - 14}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`
}

function navSymbol(label, cx, cy, color) {
  if (label === "Home") {
    return circle({ cx, cy, r: 8, fill: color })
  }

  if (label === "Leads") {
    return pathShape({ d: `M${cx} ${cy - 10}L${cx + 10} ${cy}L${cx} ${cy + 10}L${cx - 10} ${cy}Z`, fill: color })
  }

  if (label === "Pipeline") {
    return rect({ x: cx - 9, y: cy - 9, w: 18, h: 18, r: 2, fill: color })
  }

  return pathShape({ d: `M${cx} ${cy - 11}L${cx + 11} ${cy + 10}H${cx - 11}Z`, fill: color })
}

function pathShape({ d, fill, opacity = 1 }) {
  return `<path d="${d}" fill="${fill}" opacity="${opacity}"/>`
}

function card(x, y, w, h, children, fill = theme.surface) {
  return `<g>${rect({ x, y, w, h, r: 32, fill, stroke: theme.border, filter: "url(#cardShadow)" })}${children}</g>`
}

function pill(x, y, label, fill, color, options = {}) {
  const width = options.width ?? Math.max(118, label.length * 11 + 34)
  return `<g>${rect({ x, y, w: width, h: 42, r: 21, fill, stroke: options.stroke })}${text({
    x: x + width / 2,
    y: y + 28,
    value: label,
    size: 18,
    weight: 800,
    color,
    anchor: "middle",
    caps: options.caps ?? true
  })}</g>`
}

function button(x, y, w, label, fill = theme.brand, color = "#ffffff") {
  return `<g>${rect({ x, y, w, h: 68, r: 28, fill })}${text({
    x: x + w / 2,
    y: y + 43,
    value: label,
    size: 25,
    weight: 800,
    color,
    anchor: "middle"
  })}</g>`
}

function avatar(x, y, letter, fill = theme.readySoft, color = theme.ready) {
  return `<g>${circle({ cx: x + 34, cy: y + 34, r: 34, fill })}${text({
    x: x + 34,
    y: y + 45,
    value: letter,
    size: 32,
    weight: 900,
    color,
    anchor: "middle"
  })}</g>`
}

function showReadyLockup(x, y, scale = 1) {
  const mark = 46 * scale
  return `<g>
    <image href="data:image/png;base64,${iconData}" x="${x}" y="${y}" width="${mark}" height="${mark}" rx="${12 * scale}"/>
    ${text({ x: x + mark + 16 * scale, y: y + 34 * scale, value: "Show", size: 32 * scale, weight: 900 })}
    ${text({
      x: x + mark + 95 * scale,
      y: y + 34 * scale,
      value: "Ready",
      size: 32 * scale,
      weight: 900,
      color: theme.brandAlt
    })}
  </g>`
}

function deviceFrame(inner) {
  return `<g>
    ${rect({ x: PHONE.x + 18, y: PHONE.y + 28, w: PHONE.w, h: PHONE.h, r: PHONE.r, fill: "#171b26", opacity: 0.13, filter: "url(#phoneShadow)" })}
    ${rect({ x: PHONE.x, y: PHONE.y, w: PHONE.w, h: PHONE.h, r: PHONE.r, fill: "#141824" })}
    ${rect({ x: SCREEN.x, y: SCREEN.y, w: SCREEN.w, h: SCREEN.h, r: SCREEN.r, fill: theme.background })}
    ${rect({ x: PHONE.x + 410, y: PHONE.y + 34, w: 198, h: 46, r: 23, fill: "#080b12" })}
    <clipPath id="screenClip"><rect x="${SCREEN.x}" y="${SCREEN.y}" width="${SCREEN.w}" height="${SCREEN.h}" rx="${SCREEN.r}"/></clipPath>
    <g clip-path="url(#screenClip)">${inner}</g>
  </g>`
}

function pageHeader(title, subtitle, accent = theme.brand) {
  return `<g>
    ${pathShape({
      d: `M0 0H${WIDTH}V470C1040 408 854 426 662 448C426 475 202 494 0 418Z`,
      fill: "#f4efff"
    })}
    ${pathShape({
      d: `M${WIDTH} 0V410C1080 370 980 326 870 285C756 242 638 176 565 0Z`,
      fill: "#fff1e7",
      opacity: 0.92
    })}
    ${rect({ x: 84, y: 78, w: 205, h: 58, r: 29, fill: "#ffffff", stroke: theme.border })}
    ${showReadyLockup(104, 91, 0.78)}
    ${text({ x: 84, y: 256, value: title, size: 72, weight: 900, width: 1000, lineHeight: 80 })}
    ${text({ x: 86, y: 432, value: subtitle, size: 31, weight: 600, color: theme.mutedInk, width: 980, lineHeight: 42 })}
    ${rect({ x: 84, y: 510, w: 170, h: 12, r: 6, fill: accent })}
  </g>`
}

function appChrome(title, subtitle) {
  const x = SCREEN.x + 50
  const y = SCREEN.y + 54
  return `<g>
    ${showReadyLockup(x, y, 0.82)}
    ${circle({ cx: SCREEN.x + SCREEN.w - 76, cy: y + 24, r: 31, fill: theme.surface, stroke: theme.border })}
    ${text({ x, y: y + 128, value: title, size: 49, weight: 900 })}
    ${subtitle ? text({ x, y: y + 174, value: subtitle, size: 23, weight: 600, color: theme.mutedInk, width: 800 }) : ""}
  </g>`
}

function screenBottomNav(active) {
  const y = SCREEN.y + SCREEN.h - 116
  const navItems = ["Home", "Leads", "Pipeline", "Appts"]
  const gap = SCREEN.w / navItems.length
  return `<g>
    ${rect({ x: SCREEN.x + 28, y, w: SCREEN.w - 56, h: 86, r: 36, fill: theme.surface, stroke: theme.border, filter: "url(#cardShadow)" })}
    ${navItems
      .map((label, index) => {
        const cx = SCREEN.x + gap * index + gap / 2
        const isActive = label === active
        return `<g>
          ${navSymbol(label, cx, y + 28, isActive ? theme.brand : theme.subtleInk)}
          ${text({ x: cx, y: y + 64, value: label, size: 19, weight: 800, color: isActive ? theme.brand : theme.subtleInk, anchor: "middle" })}
        </g>`
      })
      .join("")}
  </g>`
}

function stageChip(stage, x, y, tone = "ready") {
  const palette =
    tone === "nurture"
      ? [theme.nurtureSoft, theme.nurture]
      : tone === "appointment"
        ? [theme.appointmentSoft, theme.appointment]
        : tone === "hold"
          ? [theme.holdSoft, theme.hold]
          : [theme.readySoft, theme.ready]
  return pill(x, y, stage, palette[0], palette[1])
}

function metricTile(x, y, label, value, fill, color) {
  return `<g>
    ${rect({ x, y, w: 250, h: 176, r: 28, fill, stroke: color, sw: 2 })}
    ${circle({ cx: x + 52, cy: y + 54, r: 26, fill: theme.surface })}
    ${checkIcon(x + 52, y + 56, color)}
    ${text({ x: x + 28, y: y + 112, value: label, size: 22, weight: 800, color })}
    ${text({ x: x + 28, y: y + 152, value, size: 45, weight: 900 })}
  </g>`
}

function leadCard(x, y, lead, options = {}) {
  const h = options.height ?? 246
  const tone = lead.tone ?? "ready"
  return card(
    x,
    y,
    SCREEN.w - 100,
    h,
    `<g>
      ${avatar(x + 28, y + 30, lead.name.slice(0, 1), tone === "nurture" ? theme.nurtureSoft : theme.readySoft, tone === "nurture" ? theme.nurture : theme.ready)}
      ${text({ x: x + 112, y: y + 58, value: lead.name, size: 30, weight: 900, width: 430 })}
      ${text({ x: x + 112, y: y + 94, value: lead.contact, size: 21, weight: 600, color: theme.mutedInk, width: 500 })}
      ${lead.intent ? pill(x + 570, y + 30, lead.intent, theme.surfaceTint, theme.brandStrong, { width: 92 }) : ""}
      ${stageChip(lead.stage, x + 676, y + 30, tone)}
      ${text({ x: x + 28, y: y + 148, value: lead.summary, size: 23, weight: 600, color: theme.mutedInk, width: SCREEN.w - 170, lineHeight: 31 })}
      ${options.actions ? button(x + 28, y + h - 82, 360, options.actions, theme.brand) : ""}
    </g>`
  )
}

function dashboardScreen() {
  const sx = SCREEN.x
  const sy = SCREEN.y
  return deviceFrame(`<g>
    ${rect({ x: sx, y: sy, w: SCREEN.w, h: SCREEN.h, fill: theme.background })}
    ${appChrome("Field dashboard")}
    ${card(
      sx + 50,
      sy + 270,
      SCREEN.w - 100,
      372,
      `<g>
        ${text({ x: sx + 82, y: sy + 325, value: "TODAY AT A GLANCE", size: 18, weight: 900, color: theme.brandStrong })}
        ${text({ x: sx + 82, y: sy + 397, value: "34 active leads", size: 48, weight: 900 })}
        ${text({ x: sx + 82, y: sy + 462, value: "12 ready to show, 7 booked, and an average qualification score of 8.4.", size: 27, weight: 600, color: theme.mutedInk, width: 650, lineHeight: 37 })}
        ${circle({ cx: sx + SCREEN.w - 154, cy: sy + 372, r: 58, fill: theme.surfaceTint })}
        ${circle({ cx: sx + SCREEN.w - 174, cy: sy + 366, r: 18, fill: theme.brandStrong })}
        ${circle({ cx: sx + SCREEN.w - 128, cy: sy + 366, r: 18, fill: theme.ink })}
        ${rect({ x: sx + SCREEN.w - 196, y: sy + 388, w: 44, h: 26, r: 10, fill: theme.brandStrong })}
        ${rect({ x: sx + SCREEN.w - 150, y: sy + 388, w: 44, h: 26, r: 10, fill: theme.ink })}
        ${line({ x1: sx + 82, y1: sy + 522, x2: sx + SCREEN.w - 82, y2: sy + 522 })}
        ${button(sx + 82, sy + 558, 292, "Invite tools")}
        ${button(sx + 396, sy + 558, 272, "Open queue", theme.surfaceTint, theme.brandStrong)}
      </g>`
    )}
    ${metricTile(sx + 50, sy + 676, "Ready", "12", theme.readySoft, theme.ready)}
    ${metricTile(sx + 324, sy + 676, "Booked", "7", theme.appointmentSoft, theme.appointment)}
    ${metricTile(sx + 598, sy + 676, "Nurture", "9", theme.nurtureSoft, theme.nurture)}
    ${card(
      sx + 50,
      sy + 900,
      SCREEN.w - 100,
      500,
      `<g>
        ${text({ x: sx + 82, y: sy + 954, value: "Recent lead movement", size: 31, weight: 900 })}
        ${text({ x: sx + SCREEN.w - 122, y: sy + 954, value: "View all", size: 22, weight: 800, color: theme.brand, anchor: "end" })}
        ${leadRow(sx + 82, sy + 1012, "Maya Chen", "maya.chen@example.com", "Ready", theme.readySoft, theme.ready)}
        ${line({ x1: sx + 82, y1: sy + 1126, x2: sx + SCREEN.w - 82, y2: sy + 1126 })}
        ${leadRow(sx + 82, sy + 1154, "Ravi Patel", "+1 416 555 0148", "Booked", theme.appointmentSoft, theme.appointment)}
        ${line({ x1: sx + 82, y1: sy + 1268, x2: sx + SCREEN.w - 82, y2: sy + 1268 })}
        ${leadRow(sx + 82, sy + 1296, "Elena Brooks", "elena@example.com", "Nurture", theme.nurtureSoft, theme.nurture)}
      </g>`
    )}
    ${screenBottomNav("Home")}
  </g>`)
}

function leadRow(x, y, name, contact, chipLabel, chipFill, chipColor) {
  return `<g>
    ${avatar(x, y, name.slice(0, 1), chipFill, chipColor)}
    ${text({ x: x + 88, y: y + 35, value: name, size: 27, weight: 900 })}
    ${text({ x: x + 88, y: y + 68, value: contact, size: 20, weight: 600, color: theme.mutedInk })}
    ${pill(x + 574, y + 8, chipLabel, chipFill, chipColor, { width: 150 })}
  </g>`
}

function newLeadsScreen() {
  const sx = SCREEN.x
  const sy = SCREEN.y
  return deviceFrame(`<g>
    ${rect({ x: sx, y: sy, w: SCREEN.w, h: SCREEN.h, fill: theme.background })}
    ${appChrome("New Leads")}
    ${button(sx + 50, sy + 282, 410, "Add lead")}
    ${button(sx + 482, sy + 282, 410, "Invite tools", theme.surfaceTint, theme.brandStrong)}
    ${leadCard(sx + 50, sy + 392, {
      name: "Maya Chen",
      contact: "maya.chen@example.com",
      intent: "BUY",
      stage: "NEW",
      tone: "ready",
      summary: "Pre-approved buyer, touring this weekend, prefers west-end detached homes near transit.",
    }, { height: 340 })}
    ${text({ x: sx + 82, y: sy + 653, value: "SUGGESTED PATH: READY TO SHOW", size: 18, weight: 900, color: theme.accent })}
    ${button(sx + 82, sy + 684, 720, "Confirm suggestion")}
    ${leadCard(sx + 50, sy + 772, {
      name: "Ravi Patel",
      contact: "+1 416 555 0148",
      intent: "RENT",
      stage: "NEW",
      tone: "nurture",
      summary: "Needs a pet-friendly rental, flexible move date, budget still being confirmed.",
    }, { height: 306 })}
    ${text({ x: sx + 82, y: sy + 1030, value: "SUGGESTED PATH: NURTURE", size: 18, weight: 900, color: theme.accent })}
    ${leadCard(sx + 50, sy + 1116, {
      name: "Elena Brooks",
      contact: "elena@example.com",
      intent: "BUY",
      stage: "NEW",
      tone: "ready",
      summary: "Returning client with clear criteria and a short list of target neighborhoods.",
    }, { height: 262 })}
    ${screenBottomNav("Leads")}
  </g>`)
}

function leadDetailScreen() {
  const sx = SCREEN.x
  const sy = SCREEN.y
  return deviceFrame(`<g>
    ${rect({ x: sx, y: sy, w: SCREEN.w, h: SCREEN.h, fill: theme.background })}
    ${showReadyLockup(sx + 50, sy + 54, 0.82)}
    ${circle({ cx: sx + SCREEN.w - 76, cy: sy + 78, r: 31, fill: theme.surface, stroke: theme.border })}
    ${text({ x: sx + 50, y: sy + 182, value: "Maya Chen", size: 49, weight: 900 })}
    ${card(
      sx + 50,
      sy + 252,
      SCREEN.w - 100,
      448,
      `<g>
        ${text({ x: sx + 82, y: sy + 312, value: "Maya Chen", size: 38, weight: 900 })}
        ${text({ x: sx + 82, y: sy + 356, value: "maya.chen@example.com - +1 416 555 0198", size: 22, weight: 600, color: theme.mutedInk, width: 560 })}
        ${text({ x: sx + 82, y: sy + 412, value: "Submitted Jun 1", size: 21, weight: 700, color: theme.subtleInk })}
        ${stageChip("READY", sx + 650, sy + 300, "ready")}
        ${button(sx + 82, sy + 462, 190, "Call", theme.surfaceTint, theme.brandStrong)}
        ${button(sx + 294, sy + 462, 190, "Text", theme.surfaceTint, theme.brandStrong)}
        ${button(sx + 506, sy + 462, 190, "Email", theme.surfaceTint, theme.brandStrong)}
        ${text({ x: sx + 82, y: sy + 593, value: "Score 9.20", size: 42, weight: 900, color: theme.brandStrong })}
        ${text({ x: sx + 82, y: sy + 646, value: "Strong financing, clear timing, and exact showing preferences.", size: 25, weight: 600, color: theme.mutedInk, width: 720 })}
      </g>`
    )}
    ${card(
      sx + 50,
      sy + 736,
      SCREEN.w - 100,
      230,
      `<g>
        ${text({ x: sx + 82, y: sy + 792, value: "Contact history", size: 31, weight: 900 })}
        ${historyRow(sx + 82, sy + 842, "Text sent", "Today at 10:18 AM")}
        ${line({ x1: sx + 82, y1: sy + 902, x2: sx + SCREEN.w - 82, y2: sy + 902 })}
        ${historyRow(sx + 82, sy + 936, "Email opened", "Yesterday at 4:42 PM")}
      </g>`
    )}
    ${card(
      sx + 50,
      sy + 1000,
      SCREEN.w - 100,
      250,
      `<g>
        ${text({ x: sx + 82, y: sy + 1056, value: "Review context", size: 31, weight: 900 })}
        ${text({ x: sx + 82, y: sy + 1115, value: "Suggested stage: ready to show", size: 24, weight: 650, color: theme.mutedInk })}
        ${text({ x: sx + 82, y: sy + 1160, value: "Reviewed stage: ready to show", size: 24, weight: 650, color: theme.mutedInk })}
        ${text({ x: sx + 82, y: sy + 1205, value: "Override: none", size: 24, weight: 650, color: theme.mutedInk })}
      </g>`
    )}
    ${card(
      sx + 50,
      sy + 1284,
      SCREEN.w - 100,
      310,
      `<g>
        ${text({ x: sx + 82, y: sy + 1340, value: "Buyer answers", size: 31, weight: 900 })}
        ${answerRow(sx + 82, sy + 1394, "Target area", "High Park, Roncesvalles")}
        ${answerRow(sx + 82, sy + 1462, "Budget", "$1.2M to $1.4M")}
        ${answerRow(sx + 82, sy + 1530, "Timeline", "Touring this weekend")}
      </g>`
    )}
  </g>`)
}

function historyRow(x, y, label, meta) {
  return `<g>${text({ x, y, value: label, size: 24, weight: 800 })}${text({
    x: x + 560,
    y,
    value: meta,
    size: 22,
    weight: 600,
    color: theme.mutedInk,
    anchor: "end"
  })}</g>`
}

function answerRow(x, y, label, value) {
  return `<g>${text({ x, y, value: label, size: 21, weight: 800, color: theme.brandStrong })}${text({
    x,
    y: y + 34,
    value,
    size: 25,
    weight: 700,
    color: theme.ink
  })}</g>`
}

function pipelineScreen() {
  const sx = SCREEN.x
  const sy = SCREEN.y
  return deviceFrame(`<g>
    ${rect({ x: sx, y: sy, w: SCREEN.w, h: SCREEN.h, fill: theme.background })}
    ${appChrome("Pipeline")}
    ${rect({ x: sx + 50, y: sy + 262, w: SCREEN.w - 100, h: 74, r: 31, fill: theme.surface, stroke: theme.border })}
    ${rect({ x: sx + 58, y: sy + 270, w: 410, h: 58, r: 28, fill: theme.brand })}
    ${text({ x: sx + 263, y: sy + 307, value: "Active", size: 24, weight: 900, color: "#ffffff", anchor: "middle" })}
    ${text({ x: sx + 685, y: sy + 307, value: "Resolved", size: 24, weight: 900, color: theme.mutedInk, anchor: "middle" })}
    ${card(
      sx + 50,
      sy + 370,
      SCREEN.w - 100,
      360,
      `<g>
        ${text({ x: sx + 82, y: sy + 426, value: "VISIBLE LEADS", size: 18, weight: 900, color: theme.brandStrong })}
        ${text({ x: sx + 82, y: sy + 474, value: "Focused queue: 18 leads need attention", size: 29, weight: 900, width: 570 })}
        ${rect({ x: sx + 684, y: sy + 416, w: 114, h: 88, r: 28, fill: theme.surfaceTint })}
        ${text({ x: sx + 741, y: sy + 456, value: "18", size: 34, weight: 900, color: theme.brandStrong, anchor: "middle" })}
        ${text({ x: sx + 741, y: sy + 484, value: "shown", size: 16, weight: 800, color: theme.brandStrong, anchor: "middle" })}
        ${rect({ x: sx + 82, y: sy + 536, w: 716, h: 64, r: 26, fill: theme.surface, stroke: theme.borderStrong })}
        ${text({ x: sx + 118, y: sy + 577, value: "Search leads, email, phone, or notes", size: 23, weight: 600, color: theme.subtleInk })}
        ${rect({ x: sx + 82, y: sy + 624, w: 716, h: 66, r: 26, fill: theme.surfaceMuted, stroke: theme.border })}
        ${text({ x: sx + 118, y: sy + 665, value: "Filters: Ready to Show - Last 7 days", size: 23, weight: 800, color: theme.ink })}
      </g>`
    )}
    ${rect({ x: sx + 50, y: sy + 760, w: SCREEN.w - 100, h: 100, r: 24, fill: "#fff7ed", stroke: "#ffd3ad" })}
    ${text({ x: sx + 82, y: sy + 801, value: "FOCUSED QUEUE", size: 17, weight: 900, color: theme.nurture })}
    ${text({ x: sx + 82, y: sy + 836, value: "Reviewed active leads worth attention now.", size: 23, weight: 650, color: theme.mutedInk })}
    ${leadCard(sx + 50, sy + 900, {
      name: "Noah Rivera",
      contact: "noah@example.com",
      intent: "BUY",
      stage: "READY",
      tone: "ready",
      summary: "Appointment tomorrow, high score, and a fresh reply waiting for follow-up.",
    }, { height: 296 })}
    ${leadCard(sx + 50, sy + 1230, {
      name: "Priya Singh",
      contact: "+1 647 555 0104",
      intent: "RENT",
      stage: "NURTURE",
      tone: "nurture",
      summary: "Budget changed this week. Follow up before the weekend showing window closes.",
    }, { height: 296 })}
    ${screenBottomNav("Pipeline")}
  </g>`)
}

function appointmentsScreen() {
  const sx = SCREEN.x
  const sy = SCREEN.y
  return deviceFrame(`<g>
    ${rect({ x: sx, y: sy, w: SCREEN.w, h: SCREEN.h, fill: theme.background })}
    ${appChrome("Appointments", "Manage your showings and history.")}
    ${card(
      sx + 50,
      sy + 308,
      SCREEN.w - 100,
      124,
      `<g>${button(sx + 82, sy + 344, 736, "Schedule showing")}</g>`
    )}
    ${rect({ x: sx + 50, y: sy + 470, w: SCREEN.w - 100, h: 74, r: 31, fill: theme.surface, stroke: theme.border })}
    ${rect({ x: sx + 58, y: sy + 478, w: 270, h: 58, r: 28, fill: theme.brand })}
    ${text({ x: sx + 193, y: sy + 515, value: "Upcoming", size: 22, weight: 900, color: "#ffffff", anchor: "middle" })}
    ${text({ x: sx + 484, y: sy + 515, value: "Completed", size: 22, weight: 900, color: theme.mutedInk, anchor: "middle" })}
    ${text({ x: sx + 734, y: sy + 515, value: "Cancelled", size: 22, weight: 900, color: theme.mutedInk, anchor: "middle" })}
    ${appointmentCard(sx + 50, sy + 586, {
      name: "Maya Chen",
      time: "2026-06-03 at 11:30",
      stage: "READY",
      notes: "Bring listing package and neighborhood comps.",
      stops: ["88 High Park Ave, Toronto", "121 Roncesvalles Ave, Toronto"]
    })}
    ${appointmentCard(sx + 50, sy + 1010, {
      name: "Noah Rivera",
      time: "2026-06-04 at 14:00",
      stage: "READY",
      notes: "Client requested condo fees before arrival.",
      stops: ["44 King St W, Toronto"]
    })}
    ${screenBottomNav("Appts")}
  </g>`)
}

function appointmentCard(x, y, item) {
  return card(
    x,
    y,
    SCREEN.w - 100,
    item.stops.length > 1 ? 376 : 330,
    `<g>
      ${text({ x: x + 32, y: y + 58, value: item.name, size: 32, weight: 900 })}
      ${text({ x: x + 32, y: y + 98, value: item.time, size: 22, weight: 650, color: theme.mutedInk })}
      ${stageChip(item.stage, x + 650, y + 38, "ready")}
      ${text({ x: x + 32, y: y + 148, value: item.notes, size: 22, weight: 600, color: theme.mutedInk, width: 690 })}
      ${item.stops
        .map((stop, index) => {
          const rowY = y + 202 + index * 76
          return `<g>
            ${pill(x + 32, rowY - 24, `Stop ${index + 1}`, theme.surfaceTint, theme.brandStrong, { width: 104, caps: false })}
            ${text({ x: x + 158, y: rowY + 3, value: stop, size: 23, weight: 750, color: theme.ink, width: 570 })}
          </g>`
        })
        .join("")}
      ${button(x + 32, y + (item.stops.length > 1 ? 298 : 254), 324, "Mark complete")}
      ${button(x + 378, y + (item.stops.length > 1 ? 298 : 254), 200, "Cancel", theme.lostSoft, theme.lost)}
    </g>`
  )
}

function defs() {
  return `<defs>
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#171b26" flood-opacity="0.08"/>
    </filter>
    <filter id="phoneShadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="24" stdDeviation="38" flood-color="#171b26" flood-opacity="0.24"/>
    </filter>
  </defs>`
}

function compose(page) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${defs()}
    ${rect({ x: 0, y: 0, w: WIDTH, h: HEIGHT, fill: theme.background })}
    ${pageHeader(page.title, page.subtitle, page.accent)}
    ${page.screen()}
  </svg>`
}

const pages = [
  {
    file: "01-field-dashboard.png",
    title: "Know who is ready now",
    subtitle: "See active lead counts, booked showings, and recent movement before your next call.",
    accent: theme.brand,
    screen: dashboardScreen
  },
  {
    file: "02-review-new-leads.png",
    title: "Review new leads fast",
    subtitle: "Confirm ShowReady's suggested path and move every client into the right queue.",
    accent: theme.accent,
    screen: newLeadsScreen
  },
  {
    file: "03-lead-detail-context.png",
    title: "Open the full client picture",
    subtitle: "Score, contact history, answers, and stage controls stay together on one mobile detail page.",
    accent: theme.ready,
    screen: leadDetailScreen
  },
  {
    file: "04-active-pipeline.png",
    title: "Prioritize the active pipeline",
    subtitle: "Search, filter, and focus on reviewed leads that need agent attention now.",
    accent: theme.brandAlt,
    screen: pipelineScreen
  },
  {
    file: "05-schedule-showings.png",
    title: "Schedule showings from the field",
    subtitle: "Create, track, complete, or cancel appointments without leaving the mobile workspace.",
    accent: theme.appointment,
    screen: appointmentsScreen
  }
]

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })

  for (const page of pages) {
    const svg = compose(page)
    const outputPath = path.join(outputDir, page.file)
    await sharp(Buffer.from(svg)).png().toFile(outputPath)
    console.log(outputPath)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
