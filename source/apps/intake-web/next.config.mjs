import os from "node:os"

function getAllowedDevOrigins() {
  const lanOrigins = new Set(["localhost", "127.0.0.1"])

  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) {
        continue
      }

      lanOrigins.add(address.address)
    }
  }

  return [...lanOrigins]
}

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: getAllowedDevOrigins()
}

export default nextConfig
