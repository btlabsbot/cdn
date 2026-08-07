const supportsColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

const CODES = {
  reset: 0,
  bold: 1,
  dim: 2,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  gray: 90,
};

function paint(text, ...styles) {
  if (!supportsColor) return text;
  const prefix = styles.map((style) => `\x1b[${CODES[style]}m`).join("");
  return `${prefix}${text}\x1b[0m`;
}

function visibleLength(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "").length;
}

const c = {
  title: (t) => paint(t, "bold", "cyan"),
  subtitle: (t) => paint(t, "dim"),
  question: (t) => paint(t, "bold", "white"),
  hint: (t) => paint(t, "dim"),
  value: (t) => paint(t, "bold", "yellow"),
  key: (t) => paint(t, "cyan"),
  info: (t) => paint(`ℹ ${t}`, "blue"),
  success: (t) => paint(`✔ ${t}`, "green"),
  warn: (t) => paint(`⚠ ${t}`, "yellow"),
  error: (t) => paint(`✖ ${t}`, "red"),
  rule: (width = 64) => paint("─".repeat(width), "dim"),
  version: (t) => paint(t, "dim"),
};

function printBox(title, rows) {
  const innerWidth = Math.max(visibleLength(title), ...rows.map((row) => visibleLength(row)), 40);
  const top = `╭${"─".repeat(innerWidth + 2)}╮`;
  const bottom = `╰${"─".repeat(innerWidth + 2)}╯`;

  console.log(paint(top, "dim"));
  console.log(`${paint("│", "dim")} ${title}${" ".repeat(innerWidth - visibleLength(title))} ${paint("│", "dim")}`);
  console.log(`${paint("├", "dim")}${paint("─".repeat(innerWidth + 2), "dim")}${paint("┤", "dim")}`);
  for (const row of rows) {
    console.log(`${paint("│", "dim")} ${row}${" ".repeat(innerWidth - visibleLength(row))} ${paint("│", "dim")}`);
  }
  console.log(paint(bottom, "dim"));
}

module.exports = { paint, visibleLength, printBox, supportsColor, c };
