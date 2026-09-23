export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("node:dns");
    try {
      dns.setServers(["8.8.8.8", "1.1.1.1"]);
      console.log("DNS servers configured to [8.8.8.8, 1.1.1.1]");
    } catch (e) {
      console.error("Failed to set DNS servers:", e);
    }
  }
}
