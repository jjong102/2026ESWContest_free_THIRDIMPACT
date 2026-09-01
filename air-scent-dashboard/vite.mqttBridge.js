import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_PORT = Number(process.env.MQTT_BRIDGE_PORT ?? 5175);

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

export function mqttBridgePlugin() {
  let bridgeProcess = null;

  function stopBridge() {
    if (bridgeProcess && !bridgeProcess.killed) {
      bridgeProcess.kill("SIGTERM");
      bridgeProcess = null;
    }
  }

  return {
    name: "mqtt-bridge",
    apply: "serve",
    async configureServer(server) {
      const script = path.join(rootDir, "server", "mqtt_bridge.py");

      // 이미 떠 있으면 재기동하지 않음 (10초 캐시 날아가며 Fresh Air가 비는 현상 방지)
      if (await isPortOpen(BRIDGE_PORT)) {
        console.log(
          `[mqtt-bridge] 이미 :${BRIDGE_PORT} 사용 중 — 기존 프로세스 재사용`
        );
      } else {
        bridgeProcess = spawn("python3", [script], {
          cwd: rootDir,
          env: process.env,
          stdio: "inherit",
        });

        bridgeProcess.on("error", (error) => {
          console.error("[mqtt-bridge] 시작 실패:", error.message);
        });
      }

      server.httpServer?.on("close", stopBridge);
      process.on("SIGINT", stopBridge);
      process.on("SIGTERM", stopBridge);
    },
  };
}
