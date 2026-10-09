/**
 * API endpoint to initiate outbound calls.
 *
 * Creates a Twilio Voice call to the specified phone number and connects
 * it to ConversationRelay via the /api/twiml endpoint.
 *
 * @route POST /api/call
 * @body {string} to - Phone number to call (E.164 format)
 * @body {string} workflow - "Customer support" or "Appointment booking"
 * @body {string} voiceId - ElevenLabs voice ID
 * @body {string} model - ElevenLabs model ID
 * @body {number} speed - Voice speed (0.7-1.2)
 * @body {number} stability - Voice stability (0-1)
 * @body {number} similarity - Voice similarity (0-1)
 * @returns {object} { ok: true, callSid: string } on success
 */

import twilio from "twilio";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  // حماية الـ API
  const agentKey = req.headers["x-agent-key"];

  if (!process.env.AGENT_API_KEY || agentKey !== process.env.AGENT_API_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  const { phoneNumber, task } = req.body || {};

  if (!phoneNumber) {
    return res.status(400).json({
      error: "phoneNumber is required",
    });
  }

  if (!task) {
    return res.status(400).json({
      error: "task is required",
    });
  }

  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER,
    NGROK_URL,
  } = process.env;

  try {
    const client = twilio(
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN
    );

    const params = new URLSearchParams({
      mode: "agent",
      task: task,
    });

    const twimlUrl =
      `https://${NGROK_URL}/api/twiml?${params.toString()}`;

    const call = await client.calls.create({
      to: phoneNumber,
      from: TWILIO_PHONE_NUMBER,
      url: twimlUrl,
      method: "POST",
    });

    return res.status(200).json({
      success: true,
      callSid: call.sid,
      status: call.status,
      phoneNumber,
      task,
    });
  } catch (error) {
    console.error("Twilio call error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
