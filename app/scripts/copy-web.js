// Copies the website (one folder up) into app/www, which is what the Android app packages.
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..", ".."), out = path.resolve(__dirname, "..", "www");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const item of ["index.html", "manifest.webmanifest", "sw.js", "css", "js", "icons"]) {
  const from = path.join(root, item);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(out, item), { recursive: true });
}
console.log("Website copied to app/www");
