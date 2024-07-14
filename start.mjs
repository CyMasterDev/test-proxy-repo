import { createBareServer } from "@tomphttp/bare-server-node";
import http from "http";
import serveStatic from "serve-static";
import { fileURLToPath } from "url";
import chalk from "chalk";

const httpServer = http.createServer();
const port = process.env.PORT || 8000;

// Run the Bare server in the /bare/ namespace. This will prevent conflicts between the static files and the bare server.
const bareServer = createBareServer("/bare/", {
    logErrors: false,
    localAddress: undefined,
    maintainer: {
        email: "tomphttp@sys32.dev",
        website: "https://github.com/tomphttp/",
    },
});

const serve = serveStatic(fileURLToPath(new URL("./build/", import.meta.url)), {
    fallthrough: false,
    extensions: ["html"],
});

const fail = (req, res, err) => {
    res.writeHead(err?.statusCode || 500, {
        "Content-Type": "text/plain",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Content-Security-Policy": "default-src 'self'",
    });
    res.end(err?.stack);
};

httpServer.on("request", async (req, res) => {
    try {
        if (bareServer.shouldRoute(req)) {
            bareServer.routeRequest(req, res);
        } else {
            serve(req, res, (err) => {
                if (err?.code === "ENOENT") {
                    req.url = "/404.html";
                    res.statusCode = 404;

                    serve(req, res, (err) => fail(req, res, err));
                } else {
                    fail(req, res, err);
                }
            });
        }
    } catch (err) {
        fail(req, res, err);
    }
});

httpServer.on("upgrade", (req, socket, head) => {
    if (bareServer.shouldRoute(req)) {
        bareServer.routeUpgrade(req, socket, head);
    } else {
        socket.end();
    }
});

httpServer.on("listening", () => {
    const address = httpServer.address();

    const theme = chalk.hex("#26233a");
    console.log(`${chalk.bold(theme("Midnight"))}`);

    console.log(
        `  ${chalk.bold("Local:")}            http://${
            address.family === "IPv6" ? `[${address.address}]` : address.address
        }${address.port === 80 ? "" : ":" + chalk.bold(address.port)}`
    );

    console.log(
        `  ${chalk.bold("Local:")}            http://localhost${
            address.port === 80 ? "" : ":" + chalk.bold(address.port)
        }`
    );

    try {
        const networkAddress = getLocalNetworkAddress();
        if (networkAddress) {
            console.log(
                `  ${chalk.bold("On Your Network:")}  http://${networkAddress}${
                    address.port === 80 ? "" : ":" + chalk.bold(address.port)
                }`
            );
        }
    } catch (err) {
        // can't find LAN interface
    }

    if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
        console.log(
            `  ${chalk.bold("Replit:")}           https://${
                process.env.REPL_SLUG
            }.${process.env.REPL_OWNER}.repl.co`
        );
    }

    if (process.env.HOSTNAME && process.env.GITPOD_WORKSPACE_CLUSTER_HOST) {
        console.log(
            `  ${chalk.bold("Gitpod:")}           https://${port}-${
                process.env.HOSTNAME
            }.${process.env.GITPOD_WORKSPACE_CLUSTER_HOST}`
        );
    }
});

httpServer.listen({ port });

// Function to get local network address
function getLocalNetworkAddress() {
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return null;
}
