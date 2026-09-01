import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const RESTART_DELAY_MS = 2000;
const WATCHDOG_MS = 4000;
const STT_PORT = Number(process.env.STT_BRIDGE_PORT || 5177);

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

export function sttBridgePlugin() {
  let bridgeProcess = null;
  let stopped = false;
  let restartTimer = null;
  let watchdogTimer = null;
  let starting = false;

  function stopBridge() {
    stopped = true;
    starting = false;
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
    if (bridgeProcess && !bridgeProcess.killed) {
      bridgeProcess.kill("SIGTERM");
    }
    bridgeProcess = null;
  }

  async function startBridge() {
    if (stopped || starting) {
      return;
    }

    if (await isPortOpen(STT_PORT)) {
      return;
    }

    starting = true;

    const script = path.join(rootDir, "server", "stt_bridge.py");
    const child = spawn("python3", [script], {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
    });

    bridgeProcess = child;
    child.on("error", (error) => {
      starting = false;
      console.error("[stt-bridge] 시작 실패:", error.message);
    });
    child.on("spawn", () => {
      starting = false;
    });
    child.on("exit", (code, signal) => {
      starting = false;
      if (bridgeProcess === child) {
        bridgeProcess = null;
      }
      if (stopped) {
        return;
      }
      console.error(
        `[stt-bridge] 종료됨 (code=${code} signal=${signal}). ${RESTART_DELAY_MS / 1000}초 후 재시작`
      );
      restartTimer = setTimeout(() => {
        startBridge().catch((error) => {
          console.error("[stt-bridge] 재시작 실패:", error.message);
        });
      }, RESTART_DELAY_MS);
    });
  }

  return {
    name: "stt-bridge",
    apply: "serve",
    configureServer(server) {
      stopped = false;
      startBridge().catch((error) => {
        console.error("[stt-bridge] 시작 실패:", error.message);
      });
      watchdogTimer = setInterval(() => {
        startBridge().catch((error) => {
          console.error("[stt-bridge] 감시 재시작 실패:", error.message);
        });
      }, WATCHDOG_MS);

      server.httpServer?.on("close", stopBridge);
      process.on("SIGINT", stopBridge);
      process.on("SIGTERM", stopBridge);
    },
  };
}
