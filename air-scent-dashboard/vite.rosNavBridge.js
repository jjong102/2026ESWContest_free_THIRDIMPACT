import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const RESTART_DELAY_MS = 2000;
const NAV_PORT = Number(process.env.ROS_NAV_BRIDGE_PORT || 5179);

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

export function rosNavBridgePlugin() {
  let bridgeProcess = null;
  let stopped = false;
  let restartTimer = null;
  let starting = false;

  function stopBridge() {
    stopped = true;
    starting = false;
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
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

    if (await isPortOpen(NAV_PORT)) {
      return;
    }

    starting = true;
    const script = path.join(rootDir, "scripts", "ros", "run_ros_nav_bridge.sh");
    const child = spawn("bash", [script], {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
    });

    bridgeProcess = child;
    child.on("error", (error) => {
      starting = false;
      console.error("[ros-nav-bridge] 시작 실패:", error.message);
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
        `[ros-nav-bridge] 종료됨 (code=${code} signal=${signal}). ${RESTART_DELAY_MS / 1000}초 후 재시작`
      );
      restartTimer = setTimeout(() => {
        startBridge().catch((error) => {
          console.error("[ros-nav-bridge] 재시작 실패:", error.message);
        });
      }, RESTART_DELAY_MS);
    });
  }

  return {
    name: "ros-nav-bridge",
    apply: "serve",
    configureServer(server) {
      startBridge().catch((error) => {
        console.error("[ros-nav-bridge] 시작 실패:", error.message);
      });
      server.httpServer?.on("close", stopBridge);
      process.on("SIGINT", stopBridge);
      process.on("SIGTERM", stopBridge);
    },
  };
}
