import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export function gdmBridgePlugin() {
  let bridgeProcess = null;

  function stopBridge() {
    if (bridgeProcess && !bridgeProcess.killed) {
      bridgeProcess.kill("SIGTERM");
      bridgeProcess = null;
    }
  }

  return {
    name: "gdm-bridge",
    apply: "serve",
    configureServer(server) {
      const script = path.join(rootDir, "server", "gdm_bridge.py");

      bridgeProcess = spawn("python3", [script], {
        cwd: rootDir,
        env: process.env,
        stdio: "inherit",
      });

      bridgeProcess.on("error", (error) => {
        console.error("[gdm-bridge] 시작 실패:", error.message);
      });

      server.httpServer?.on("close", stopBridge);
      process.on("SIGINT", stopBridge);
      process.on("SIGTERM", stopBridge);
    },
  };
}
