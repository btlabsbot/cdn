const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { paint, c } = require("./lib/colors");

const ROOT_DIR = path.join(__dirname, "..");
const CONFIG_PATH = path.join(ROOT_DIR, "lynxnodes.config.json");
const CONFIG_PATH_LABEL = path.relative(process.cwd(), CONFIG_PATH) || "lynxnodes.config.json";

const APP_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf-8"));
    return pkg.version || "1.0b";
  } catch {
    return "1.0b";
  }
})();

function printHeader() {
  console.log(c.rule());
  console.log(
    `  ${paint("⚡", "yellow", "bold")} ${c.title("lynxcdn")} ${c.version(`v${APP_VERSION}`)} ${c.subtitle(
      "— utilidades de LynxNodes CDN"
    )}`
  );
  console.log(c.rule());
  console.log();
}

function printCommandsList() {
  console.log(`  ${c.key("Comandos disponibles:")}`);
  console.log(`    ${c.value("lynxcdn reset")}${" ".repeat(9)}Borra la configuración guardada (${c.hint(CONFIG_PATH_LABEL)})`);
  console.log(`    ${c.value("lynxcdn reset --yes")}${" ".repeat(3)}Borra sin pedir confirmación (útil en scripts/CI)`);
  console.log(`    ${c.value("lynxcdn config")}${" ".repeat(8)}Muestra la configuración guardada actualmente`);
  console.log(`    ${c.value("lynxcdn help")}${" ".repeat(10)}Muestra esta ayuda`);
  console.log();
}

function printHelp() {
  printHeader();
  printCommandsList();
}

function confirm(question) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      // Sin terminal interactiva no podemos preguntar: por seguridad, no borramos.
      resolve(false);
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${c.warn(question)} ${c.hint("(s/N)")} `, (answer) => {
      rl.close();
      resolve(/^s(í|i)?$/i.test(answer.trim()));
    });
  });
}

function readCurrentConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

async function cmdReset(args) {
  printHeader();

  if (!fs.existsSync(CONFIG_PATH)) {
    console.log(c.info(`No hay ninguna configuración guardada en ${c.key(CONFIG_PATH_LABEL)}, nada que borrar.`));
    return;
  }

  const previous = readCurrentConfig();
  if (previous) {
    console.log(c.info(`Configuración actual encontrada en ${c.key(CONFIG_PATH_LABEL)}:`));
    console.log(`    ${c.key("Sitio")}   ${c.value(previous.SITE_NAME ?? "—")}`);
    console.log(`    ${c.key("Nodos")}   ${c.value(previous.NODE_ID ?? "—")} ${c.hint(`x${previous.NODE_COUNT ?? "?"}`)}`);
    if (previous.updatedAt) {
      console.log(`    ${c.key("Guardada")} ${c.hint(previous.updatedAt)}`);
    }
    console.log();
  }

  const skipConfirm = args.includes("--yes") || args.includes("-y");
  const confirmed = skipConfirm || (await confirm("¿Seguro que quieres borrar esta configuración?"));

  if (!confirmed) {
    console.log(c.warn("Cancelado: no se ha borrado nada."));
    return;
  }

  try {
    fs.unlinkSync(CONFIG_PATH);
    console.log(c.success("Configuración borrada correctamente."));
    console.log(c.hint(`La próxima vez que ejecutes "npm run dev" se usarán los valores de fábrica.`));
  } catch (err) {
    console.log(c.error(`No se pudo borrar ${CONFIG_PATH_LABEL}: ${err.message}`));
    process.exitCode = 1;
  }
}

function cmdShowConfig() {
  printHeader();

  const parsed = readCurrentConfig();
  if (parsed === null) {
    console.log(c.info(`No hay ninguna configuración guardada todavía en ${c.key(CONFIG_PATH_LABEL)}.`));
    return;
  }

  console.log(c.key(CONFIG_PATH_LABEL));
  console.log(paint(JSON.stringify(parsed, null, 2), "yellow"));
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "reset":
    case "clean":
    case "clear":
      await cmdReset(args);
      break;
    case "config":
    case "show":
      cmdShowConfig();
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;
    default:
      printHeader();
      console.log(c.error(`Comando desconocido: "${command}"`));
      console.log();
      printCommandsList();
      process.exitCode = 1;
  }
}

main();
