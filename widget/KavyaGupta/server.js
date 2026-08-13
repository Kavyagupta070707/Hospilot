const http = require("http");
const fs = require("fs");
const path = require("path");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const HOSPILOT_BASE_URL = "https://hospilot.carer.ai";
const CANDIDATE_PREFIX = "[CANDIDATE-KavyaGupta]";
const activeSessions = new Map();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function hospilotFetch(urlPath, options = {}) {
  const response = await fetch(`${HOSPILOT_BASE_URL}${urlPath}`, options);
  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message = data.error || data.message || data.detail || text || `Hospilot returned ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function loginToHospilot() {
  const username = process.env.HOSPILOT_USERNAME;
  const password = process.env.HOSPILOT_PASSWORD;

  if (!username || !password) {
    throw new Error("Missing HOSPILOT_USERNAME or HOSPILOT_PASSWORD in environment");
  }

  return hospilotFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
}

function withCandidatePrefix(goal) {
  const trimmedGoal = String(goal || "").trim();
  if (!trimmedGoal) return "";
  if (trimmedGoal.startsWith(CANDIDATE_PREFIX)) return trimmedGoal;
  return `${CANDIDATE_PREFIX} ${trimmedGoal}`;
}

async function createSession(req, res) {
  try {
    const body = await readJson(req);
    const goal = withCandidatePrefix(body.goal);

    if (!goal) {
      return sendJson(res, 400, { error: "Goal is required" });
    }

    const login = await loginToHospilot();
    const token = login.token;

    if (!token) {
      throw new Error("Login succeeded but no token was returned");
    }

    const session = await hospilotFetch("/api/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        goal,
        constraints: "",
        autonomous: false
      })
    });

    const sessionId = session.session_id || session.sessionId;
    if (!sessionId) {
      throw new Error("Session was created but no session_id was returned");
    }

    activeSessions.set(sessionId, { token, createdAt: Date.now() });

    sendJson(res, 200, {
      sessionId,
      status: session.status,
      autonomous: session.autonomous,
      token
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function getSession(req, res, sessionId) {
  try {
    const saved = activeSessions.get(sessionId);
    if (!saved) {
      return sendJson(res, 404, { error: "Unknown session. Create a new plan first." });
    }

    const session = await hospilotFetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { "Authorization": `Bearer ${saved.token}` }
    });

    sendJson(res, 200, {
      sessionId,
      status: session.status,
      pipelineReady: Boolean(session.pipeline && Object.keys(session.pipeline).length > 0),
      pipeline: session.pipeline || null
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = path.join(__dirname, pathname);
  const resolved = path.resolve(filePath);

  if (!resolved.startsWith(__dirname)) {
    return sendText(res, 403, "Forbidden");
  }

  fs.readFile(resolved, (error, contents) => {
    if (error) return sendText(res, 404, "Not found");

    const ext = path.extname(resolved);
    const contentType = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8"
    }[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(contents);
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && requestUrl.pathname === "/api/sessions") {
    return createSession(req, res);
  }

  const sessionMatch = requestUrl.pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (req.method === "GET" && sessionMatch) {
    return getSession(req, res, decodeURIComponent(sessionMatch[1]));
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    return sendJson(res, 404, { error: "API route not found" });
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Hospilot widget running at http://localhost:${PORT}`);
});
