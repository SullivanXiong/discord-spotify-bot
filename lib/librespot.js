"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const which = require("which");

class LibrespotController {
    constructor(options = {}) {
        this.deviceName = options.deviceName || process.env.LIBRESPOT_DEVICE_NAME || "Discord Connect";
        this.fifoPath = options.fifoPath || process.env.LIBRESPOT_FIFO_PATH || path.join(os.tmpdir(), "librespot-discord.fifo");
        this.librespotPath = options.librespotPath || process.env.LIBRESPOT_PATH || null;
        this.sampleRate = 48000; // Discord expects 48kHz
        this.format = "S16"; // Signed 16-bit PCM
        this.process = null;
    }

    ensureFifo() {
        if (fs.existsSync(this.fifoPath)) {
            const stat = fs.statSync(this.fifoPath);
            // If it's a regular file, remove and recreate as FIFO
            if (!stat.isFIFO && typeof stat.isFIFO !== "function") {
                // Node's fs.Stats may not have isFIFO on some platforms; fall back to recreate
                fs.rmSync(this.fifoPath, { force: true });
            } else if (typeof stat.isFIFO === "function" && !stat.isFIFO()) {
                fs.rmSync(this.fifoPath, { force: true });
            }
        }

        if (!fs.existsSync(this.fifoPath)) {
            // mkfifo is available on Linux; create with world rw so ffmpeg/node can read
            spawn("mkfifo", ["-m", "666", this.fifoPath]);
        }
    }

    resolveLibrespotPath() {
        if (this.librespotPath && fs.existsSync(this.librespotPath)) {
            return this.librespotPath;
        }
        try {
            const resolved = which.sync("librespot");
            return resolved;
        } catch (err) {
            return null;
        }
    }

    isRunning() {
        return !!this.process;
    }

    start() {
        if (this.process) return;

        const binary = this.resolveLibrespotPath();
        if (!binary) {
            throw new Error("librespot binary not found. Install librespot and/or set LIBRESPOT_PATH env.");
        }

        this.ensureFifo();

        const args = [
            "--name", this.deviceName,
            "--backend", "pipe",
            "--device", this.fifoPath,
            "--format", this.format,
            "--sample-rate", String(this.sampleRate),
            "--bitrate", process.env.LIBRESPOT_BITRATE || "160",
            "--disable-audio-cache",
            "--device-type", process.env.LIBRESPOT_DEVICE_TYPE || "speaker",
            // Zeroconf enabled by default; bind to random port if provided
            ...(process.env.LIBRESPOT_ZEROCONF_PORT ? ["--zeroconf-port", process.env.LIBRESPOT_ZEROCONF_PORT] : [])
        ];

        this.process = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });

        this.process.stdout.on("data", (data) => {
            // librespot logs to stdout
            process.stdout.write(`[librespot] ${data}`);
        });
        this.process.stderr.on("data", (data) => {
            process.stderr.write(`[librespot] ${data}`);
        });
        this.process.on("exit", (code, signal) => {
            this.process = null;
            console.log(`librespot exited with code ${code} signal ${signal}`);
        });
        this.process.on("error", (err) => {
            console.error("Failed to start librespot:", err);
            this.process = null;
        });
    }

    stop() {
        if (!this.process) return;
        try {
            this.process.kill("SIGTERM");
        } catch (_) {}
        this.process = null;
    }
}

module.exports = { LibrespotController };

