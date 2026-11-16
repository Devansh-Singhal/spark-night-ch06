import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { readSimulatorUrl } from "./model.js";

const output = new URL("./dist/", import.meta.url);
const assets = {
  "index.html": "text/html",
  "style.css": "text/css",
  "main.js": "text/javascript",
  "model.js": "text/javascript",
  "simulator.js": "text/javascript",
};

if (process.argv.includes("--serve")) {
  await readFile(new URL("index.html", output));
  createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const name = pathname === "/" ? "index.html" : pathname.slice(1);
    if (!Object.hasOwn(assets, name)) {
      response.writeHead(404).end("Not found");
      return;
    }
    try {
      const file = await readFile(new URL(name, output));
      response.writeHead(200, { "Content-Type": `${assets[name]}; charset=utf-8`, "Cache-Control": "no-store" });
      response.end(file);
    } catch {
      response.writeHead(404).end("Not found");
    }
  }).listen(4179, "127.0.0.1", () => console.log("Nabz site: http://127.0.0.1:4179"));
} else {
  const url = readSimulatorUrl(process.env.NABZ_SIMULATOR_URL);
  await mkdir(output, { recursive: true });
  await Promise.all(Object.keys(assets).filter((name) => name !== "simulator.js").map((name) => {
    return copyFile(new URL(name, import.meta.url), new URL(name, output));
  }));
  await writeFile(new URL("simulator.js", output), `export const simulatorUrl = ${JSON.stringify(url)};\n`);
  console.log("Site built in site/dist");
}
