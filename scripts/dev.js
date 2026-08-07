
const readline = require("node:readline");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const concurrentlyModule = require("concurrently");
const concurrently = concurrentlyModule.default ?? concurrentlyModule;
const { paint, printBox, c } = require("./lib/colors");

const ROOT_DIR = path.join(__dirname, "..");
const APP_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf-8"));
    return pkg.version || "1.0b";
  } catch {
    return "1.0b";
  }
})();

function printBanner() {
  console.log(c.rule());
  console.log(
    `  ${paint("⚡", "yellow", "bold")} ${c.title("LynxNodes CDN")} ${c.version(`v${APP_VERSION}`)} ${c.subtitle(
      "— configuración de arranque"
    )}`
  );
  console.log(`  ${c.hint("(Enter para usar el valor por defecto)")}`);
  console.log(c.rule());
  console.log();
}

const CONFIG_PATH = path.join(ROOT_DIR, "lynxnodes.config.json");
const CONFIG_PATH_LABEL = path.relative(process.cwd(), CONFIG_PATH) || "lynxnodes.config.json";

const HARDCODED_DEFAULTS = {
  SITE_NAME: "LynxNodes",
  NODE_ID: "node-local",
  NODE_COUNT: "1",
};

function loadDefaults() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log(c.info(`No existe ${c.key(CONFIG_PATH_LABEL)} todavía, se creará con los valores por defecto de fábrica.`));
    saveDefaults(HARDCODED_DEFAULTS);
    return { ...HARDCODED_DEFAULTS };
  }

  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    const merged = { ...HARDCODED_DEFAULTS, ...parsed };
    console.log(
      c.info(
        `Configuración por defecto cargada desde ${c.key(CONFIG_PATH_LABEL)} ${c.hint("(bórrala con: lynxcdn reset)")}`
      )
    );
    return merged;
  } catch (err) {
    console.log(c.warn(`No se pudo leer ${CONFIG_PATH_LABEL} (${err.message}), usando valores de fábrica.`));
    return { ...HARDCODED_DEFAULTS };
  }
}

function saveDefaults(defaults) {
  try {
    const payload = { ...defaults, updatedAt: new Date().toISOString(), version: APP_VERSION };
    fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  } catch (err) {
    console.log(c.warn(`No se pudo guardar la configuración en ${CONFIG_PATH_LABEL}: ${err.message}`));
  }
}

const DEFAULTS = loadDefaults();

const GATEWAY_PORT = 3000;
const HUB_PORT = 3001;
const CDN_BASE_PORT = 8080;

const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME?.trim() || "admin";
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || "admin";

function ask(rl, question, fallback) {
  return new Promise((resolve) => {
    const suffix = fallback ? ` ${c.hint(`[${fallback}]`)}` : "";
    rl.question(`${c.question(question)}${suffix} `, (answer) => {
      const trimmed = answer.trim();
      resolve(trimmed.length > 0 ? trimmed : fallback);
    });
  });
}

async function askNodeCount(rl, fallback) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await ask(rl, "¿Cuántos nodos quieres levantar?", fallback);
    const parsed = parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed >= 1) return parsed;
    console.log(c.warn(`"${raw}" no es un número entero válido (mínimo 1). Inténtalo de nuevo.`));
  }
  console.log(c.warn(`Demasiados intentos, se usa el valor por defecto (${fallback}).`));
  return Math.max(1, parseInt(fallback, 10) || 1);
}

async function gatherConfig() {
  const envSiteName = process.env.SITE_NAME?.trim();
  const envNodeId = process.env.NODE_ID?.trim();
  const envNodeCount = process.env.NODE_COUNT?.trim();

  const interactive = process.stdin.isTTY && !(envSiteName && envNodeId && envNodeCount);

  let siteName;
  let nodePrefix;
  let nodeCount;

  if (!interactive) {
    siteName = envSiteName || DEFAULTS.SITE_NAME;
    nodePrefix = envNodeId || DEFAULTS.NODE_ID;
    nodeCount = Math.max(1, parseInt(envNodeCount ?? DEFAULTS.NODE_COUNT, 10) || 1);
    console.log(c.info("Entrada no interactiva detectada (CI, pipe o variables ya definidas): se usan valores por defecto sin preguntar."));
  } else {
    printBanner();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    siteName = envSiteName || (await ask(rl, "Nombre del sitio:", DEFAULTS.SITE_NAME));
    nodePrefix = envNodeId || (await ask(rl, "Nombre/prefijo de los nodos:", DEFAULTS.NODE_ID));
    nodeCount = envNodeCount
      ? Math.max(1, parseInt(envNodeCount, 10) || 1)
      : await askNodeCount(rl, DEFAULTS.NODE_COUNT);

    rl.close();
  }

  // La configuración recién resuelta pasa a ser la nueva propuesta por
  // defecto la próxima vez que se ejecute `npm run dev`.
  saveDefaults({
    SITE_NAME: siteName,
    NODE_ID: nodePrefix,
    NODE_COUNT: String(nodeCount),
  });

  return { siteName, nodePrefix, nodeCount };
}

function nodeIdFor(prefix, index, total) {
  return total === 1 ? prefix : `${prefix}-${index + 1}`;
}

// Comprueba si un puerto TCP en localhost está libre.
function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => tester.close(() => resolve(true)))
      .listen(port, "127.0.0.1");
  });
}

async function checkPorts(ports) {
  const results = await Promise.all(
    ports.map(async ({ label, port }) => ({ label, port, free: await isPortFree(port) }))
  );
  const busy = results.filter((r) => !r.free);
  if (busy.length > 0) {
    console.log(c.warn("Algunos puertos ya están en uso, puede que ese servicio falle al arrancar:"));
    for (const b of busy) {
      console.log(`    ${paint("•", "yellow")} ${c.key(b.label)} ${c.hint(`(puerto ${b.port})`)}`);
    }
    console.log();
  }
  return busy;
}

function printSummary({ siteName, nodePrefix, nodeCount }) {
  const rows = [
    `${c.key("Sitio")}     ${c.value(siteName)}`,
    `${c.key("Nodos")}     ${c.value(String(nodeCount))} ${c.hint(`(prefijo "${nodePrefix}")`)}`,
    `${c.key("Gateway")}   ${paint(`http://localhost:${GATEWAY_PORT}`, "blue")}`,
    `${c.key("Hub")}       ${paint(`http://localhost:${HUB_PORT}`, "magenta")}`,
  ];
  for (let i = 0; i < nodeCount; i++) {
    const port = CDN_BASE_PORT + i;
    const nodeId = nodeIdFor(nodePrefix, i, nodeCount);
    rows.push(`${c.key(nodeId)}${" ".repeat(Math.max(1, 10 - nodeId.length))}${paint(`http://localhost:${port}`, "green")}`);
  }
  rows.push(`${c.key("Config")}    ${c.hint(CONFIG_PATH_LABEL)}`);
  rows.push("");
  rows.push(`${c.key("Usuario")}    ${c.value(DEFAULT_ADMIN_USERNAME)} ${c.hint("(por defecto)")}`);
  rows.push(`${c.key("Contraseña")} ${c.value(DEFAULT_ADMIN_PASSWORD)} ${c.hint("(por defecto)")}`);
  rows.push(c.hint("cámbiala en Panel → Cuenta → Restablecer contraseña"));

  console.log();
  printBox(`${c.success("Configuración lista")} ${c.version(`(v${APP_VERSION})`)}`, rows);
  console.log();
}

async function main() {
  const { siteName, nodePrefix, nodeCount } = await gatherConfig();

  const portsToCheck = [
    { label: "gateway", port: GATEWAY_PORT },
    { label: "hub", port: HUB_PORT },
    ...Array.from({ length: nodeCount }, (_, i) => ({
      label: nodeIdFor(nodePrefix, i, nodeCount),
      port: CDN_BASE_PORT + i,
    })),
  ];
  await checkPorts(portsToCheck);

  printSummary({ siteName, nodePrefix, nodeCount });

  const commands = [
    {
      command: "npm run dev -w @lynxnodes/api-gateway",
      name: "gateway",
      prefixColor: "blue",
      env: { PORT: String(GATEWAY_PORT) },
    },
    {
      command: "npm run dev -w @lynxnodes/lynx-hub",
      name: "hub",
      prefixColor: "magenta",
      env: { NEXT_PUBLIC_SITE_NAME: siteName },
    },
  ];

  for (let i = 0; i < nodeCount; i++) {
    const port = CDN_BASE_PORT + i;
    const nodeId = nodeIdFor(nodePrefix, i, nodeCount);
    commands.push({
      command: "npm run dev -w @lynxnodes/cdn-engine",
      name: nodeId,
      prefixColor: "green",
      env: {
        NODE_ID: nodeId,
        NODE_REGION: "local",
        PORT: String(port),
        GATEWAY_URL: `http://localhost:${GATEWAY_PORT}`,
      },
    });
  }

  console.log(c.info("Levantando servicios... (Ctrl+C para detener todo)"));
  console.log();

  const { result } = concurrently(commands, {
    killOthers: ["failure", "success"],
    prefix: "name",
  });

  result.then(
    () => {
      console.log();
      console.log(c.success("Todos los procesos terminaron correctamente."));
      process.exit(0);
    },
    (err) => {
      console.log();
      console.log(c.error(`Uno o más procesos fallaron: ${err?.message ?? err}`));
      process.exit(1);
    }
  );
}

main();