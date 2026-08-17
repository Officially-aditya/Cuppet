import { cp, mkdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";

const project = resolve(import.meta.dirname, "..");
const source = resolve(project, ".open-next");
const destination = resolve(project, "dist");
const server = resolve(destination, "server");

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, server, { recursive: true });
await rename(resolve(server, "worker.js"), resolve(server, "index.js"));

// Sites expects static assets alongside the server entrypoint while OpenNext's
// worker keeps the same relative asset layout inside dist/server.
await cp(resolve(source, "assets"), resolve(destination, "assets"), {
  recursive: true
});
