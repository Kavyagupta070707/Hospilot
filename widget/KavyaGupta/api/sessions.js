const HOSPILOT_BASE_URL = "https://hospilot.carer.ai";
const CANDIDATE_PREFIX = "[CANDIDATE-KavyaGupta]";

async function hospilotFetch(path, options = {}) {
  const response = await fetch(`${HOSPILOT_BASE_URL}${path}`, options);
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

function withCandidatePrefix(goal) {
  const trimmedGoal = String(goal || "").trim();
  if (!trimmedGoal) return "";
  if (trimmedGoal.startsWith(CANDIDATE_PREFIX)) return trimmedGoal;
  return `${CANDIDATE_PREFIX} ${trimmedGoal}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const username = process.env.HOSPILOT_USERNAME;
    const password = process.env.HOSPILOT_PASSWORD;
    const goal = withCandidatePrefix(req.body?.goal);

    if (!username || !password) {
      return res.status(500).json({ error: "Missing Hospilot credentials" });
    }

    if (!goal) {
      return res.status(400).json({ error: "Goal is required" });
    }

    const login = await hospilotFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!login.token) {
      throw new Error("Login succeeded but no token was returned");
    }

    const session = await hospilotFetch("/api/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${login.token}`,
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

    return res.status(200).json({
      sessionId,
      status: session.status,
      autonomous: session.autonomous,
      token: login.token
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
