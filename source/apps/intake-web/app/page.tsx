import { MobileAuthBridge } from "@/components/mobile-auth-bridge"

export default function HomePage() {
  return (
    <MobileAuthBridge>
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "40px 24px",
          background:
            "radial-gradient(circle at top left, rgba(31,95,87,0.12), transparent 30%), linear-gradient(180deg, var(--sr-bone-raised), var(--sr-bone))"
        }}
      >
        <section
          style={{
            maxWidth: 760,
            background: "var(--sr-bone-raised)",
            border: "1px solid var(--sr-border)",
            borderRadius: 32,
            padding: 40,
            boxShadow: "var(--sr-shadow-soft)"
          }}
        >
          <p
            style={{
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontSize: 12,
              color: "var(--sr-cypress)"
            }}
          >
            ShowReady Native Rebuild
          </p>
          <h1
            style={{
              fontFamily: "var(--sr-font-display)",
              fontSize: "clamp(2.5rem, 6vw, 4.75rem)",
              lineHeight: 1,
              marginBottom: 16
            }}
          >
            Private-client command center for modern real-estate workflows.
          </h1>
          <p
            style={{
              color: "var(--sr-ink-muted)",
              lineHeight: 1.6,
              fontSize: 18,
              marginBottom: 0
            }}
          >
            This app hosts the public invite intake flow and the typed backend routes
            consumed by the native agent app.
          </p>
        </section>
      </main>
    </MobileAuthBridge>
  )
}
