/**
 * TwiML endpoint for ConversationRelay.
 *
 * Connects the phone call to the ConversationRelay WebSocket
 * using Gulf Arabic speech recognition and Arabic TTS.
 *
 * @route POST /api/twiml
 * @query {string} mode - "support" or "booking"
 */

import { validateTwilioRequest } from "../../lib/twilio-validate.mjs";

export default function handler(req, res) {
  // ============================================================
  // SECURITY: TWILIO WEBHOOK SIGNATURE VALIDATION
  // ============================================================
  if (process.env.NODE_ENV === "production") {
    if (!validateTwilioRequest(req)) {
      return res.status(403).json({
        error: "Invalid Twilio signature",
      });
    }
  }
  // ============================================================

  const { NGROK_URL } = process.env;

  if (!NGROK_URL) {
    return res.status(500).json({
      error: "NGROK_URL is not configured",
    });
  }

  const mode = req.query.mode || "support";
const task = req.query.task || "";
  const wsParams = new URLSearchParams({
  task: task,
});

const wsUrl =
  `wss://${NGROK_URL}/ws?${wsParams.toString()}`;

  const greeting =
    mode === "booking"
      ? "السلام عليكم، أنا المساعد الشخصي لسلطان. كيف أقدر أساعدك في الحجز؟"
      : "السلام عليكم، أنا المساعد الشخصي لسلطان. كيف أقدر أخدمك؟";

  res.setHeader("Content-Type", "text/xml");

  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay
      url="${wsUrl}"
      ttsProvider="Amazon"
      voice="Hala-Neural"
      ttsLanguage="ar-AE"
      transcriptionProvider="Google"
      transcriptionLanguage="ar-AE"
      welcomeGreeting="${greeting}"
    />
  </Connect>
</Response>`);
}
