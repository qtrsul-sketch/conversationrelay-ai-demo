import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const dev = process.env.NODE_ENV !== "production";
const PORT = process.env.PORT || 3000;

const SYSTEM_PROMPT = `
أنت المساعد الشخصي الصوتي الخاص بسلطان.

تحدث دائماً باللغة العربية وبلهجة خليجية طبيعية وواضحة.
لا تتحدث بالإنجليزية إلا إذا طلب منك الطرف الآخر ذلك صراحة.

مهمتك هي إجراء محادثة هاتفية طبيعية بالنيابة عن سلطان.

قواعد المحادثة:
- تحدث بأسلوب بشري طبيعي ومختصر.
- استخدم اللهجة الخليجية بشكل طبيعي بدون مبالغة.
- استمع جيداً للطرف الآخر وأجب بناءً على كلامه.
- لا تستخدم قوائم أو رموز أو إيموجي لأن ردك سيُقرأ صوتياً.
- انطق الأرقام والأوقات والتواريخ بالكلمات بطريقة طبيعية.
- إذا لم تفهم كلام الطرف الآخر، اطلب منه إعادة الكلام بأدب.
- لا تدّعي أنك نفذت شيئاً لم يتم تنفيذه فعلاً.
- لا توافق على دفع أو التزام مالي بدون موافقة سلطان.
- إذا كنت تتصل لإتمام مهمة، ركز على إنجاز المهمة ثم أكد النتيجة بوضوح.
`;

const sessions = new Map();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function aiResponse(conversation, task = "") {
  const taskPrompt = task
    ? `
المهمة الحالية في هذه المكالمة:
${task}

نفذ هذه المهمة أثناء المكالمة.
لا تخرج عن هدف المكالمة.
إذا لم يكن الخيار المطلوب متاحاً، اسأل عن أقرب بديل مناسب.
لا توافق على أي دفع أو التزام مالي بدون موافقة سلطان.
`
    : "";

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT + taskPrompt,
      },
      ...conversation,
    ],
    temperature: 0.4,
  });

  return response.choices[0].message.content;
}

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({
    server,
    path: "/ws",
  });

 wss.on("connection", (ws, request) => {
  console.log("WebSocket connected");

  const requestUrl = new URL(
    request.url,
    `http://${request.headers.host}`
  );

  ws.task = requestUrl.searchParams.get("task") || "";

  console.log("Call task:", ws.task);
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "setup") {
          console.log("Setup for call:", message.callSid);

          ws.callSid = message.callSid;
          sessions.set(message.callSid, []);

          return;
        }

        if (message.type === "prompt") {
          console.log("Prompt:", message.voicePrompt);

          const conversation =
            sessions.get(ws.callSid) || [];

          conversation.push({
            role: "user",
            content: message.voicePrompt,
          });

          try {
            const response = await aiResponse(
  conversation,
  ws.task
);

            conversation.push({
              role: "assistant",
              content: response,
            });

            sessions.set(ws.callSid, conversation);

            ws.send(
              JSON.stringify({
                type: "text",
                token: response,
                last: true,
              })
            );

            console.log("Response:", response);
          } catch (err) {
            console.error("OpenAI error:", err);

            ws.send(
              JSON.stringify({
                type: "text",
                token:
                  "صار عندي خطأ بسيط، ممكن تعيد كلامك مرة ثانية؟",
                last: true,
              })
            );
          }
        }
      } catch (err) {
        console.error("WebSocket message error:", err);
      }
    });

    ws.on("close", () => {
      console.log("WebSocket closed");

      if (ws.callSid) {
        sessions.delete(ws.callSid);
      }
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
    });
  });

  server.listen(PORT, () => {
    console.log(
      `Server running at http://localhost:${PORT}`
    );
  });
});
