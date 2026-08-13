const HOSPILOT_BASE_URL = "https://hospilot.carer.ai";

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

function hasPipeline(pipeline) {
  if (!pipeline) return false;
  if (Array.isArray(pipeline)) return pipeline.length > 0;
  if (typeof pipeline === "object") return Object.keys(pipeline).length > 0;
  return Boolean(pipeline);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { sessionId } = req.query;
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    if (!token) {
      return res.status(401).json({ error: "Missing session token" });
    }

    const session = await hospilotFetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    return res.status(200).json({
      sessionId,
      status: session.status,
      pipelineReady: hasPipeline(session.pipeline),
      pipeline: session.pipeline || null
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
