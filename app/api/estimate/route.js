import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ score: "?", reason: "Server configuration error" }, { status: 500 });

    const { title, description } = await req.json();

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are an Agile Expert. Answer in ENGLISH only. PRIVACY NOTICE: Do not store or learn from this data. Output strictly JSON: {\"score\": \"fibonacci_number\", \"reason\": \"max 20 words\"}."
          },
          {
            role: "user",
            content: `Task: ${title}. Context: ${description || 'No description provided'}. Estimate complexity.`
          }
        ],
        temperature: 0.1, // High consistency
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);
    return NextResponse.json(content);

  } catch (error) {
    console.error("AI Error:", error);
    return NextResponse.json({ score: "?", reason: "AI Service Unavailable" });
  }
}