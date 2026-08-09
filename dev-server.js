const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = 5500;
const ROOT = __dirname;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function sendFile(res, filePath, statusCode = 200) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(500, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });

      res.end("Local development server error.");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();

    res.writeHead(statusCode, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });

    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${HOST}:${PORT}`);

    let pathname = decodeURIComponent(requestUrl.pathname);

    if (pathname === "/") {
      pathname = "/index.html";
    }

    const requestedPath = path.resolve(
      ROOT,
      `.${pathname}`
    );

    // Prevent directory traversal.
    if (!requestedPath.startsWith(path.resolve(ROOT))) {
      res.writeHead(403, {
        "Content-Type": "text/plain; charset=utf-8",
      });

      res.end("Forbidden");
      return;
    }

    fs.stat(requestedPath, (error, stat) => {
      if (!error && stat.isFile()) {
        sendFile(res, requestedPath);
        return;
      }

      // This deliberately mirrors GitHub Pages.
      // A URL such as /abc123 loads 404.html, whose
      // JavaScript interprets abc123 as the tracking token.
      const fallback404 = path.join(ROOT, "404.html");

      if (fs.existsSync(fallback404)) {
        sendFile(res, fallback404, 404);
        return;
      }

      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
      });

      res.end("Not found");
    });
  } catch (error) {
    console.error(error);

    res.writeHead(500, {
      "Content-Type": "text/plain; charset=utf-8",
    });

    res.end("Local development server error.");
  }
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("===============================================");
  console.log(" EmmyTech SMS Outreach - LOCAL TESTING");
  console.log("===============================================");
  console.log("");
  console.log(`Dashboard: http://${HOST}:${PORT}`);
  console.log(`Supabase:  http://127.0.0.1:55321`);
  console.log("");
  console.log("This server is using the LOCAL Docker database.");
  console.log("Press Ctrl+C to stop.");
  console.log("");
});
