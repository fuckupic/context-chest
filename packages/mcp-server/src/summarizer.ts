const MAX_INPUT_LENGTH = 5000;
const MAX_L0_LENGTH = 500;
const MAX_L1_LENGTH = 10000;

export function buildL0Prompt(content: string): string {
  const truncated = content.slice(0, MAX_INPUT_LENGTH);
  return `Summarize the following content in one sentence. Be generic — no secrets, no PII, no specific values, no API keys, no passwords. Focus on topic and type only.

Content:
${truncated}

Respond with ONLY the one-sentence summary, nothing else.`;
}

export function buildL1Prompt(content: string): string {
  const truncated = content.slice(0, MAX_INPUT_LENGTH);
  return `Create a structured overview of the following content. Include: topic, key concepts, entities mentioned (generic names OK), and type of content. Do NOT include specific values, credentials, code secrets, or personal data.

Keep it under 2000 tokens. Use markdown formatting.

Content:
${truncated}

Respond with ONLY the structured overview, nothing else.`;
}

export function parseL0Response(response: string): string {
  return response.trim().slice(0, MAX_L0_LENGTH);
}

export function parseL1Response(response: string): string {
  return response.trim().slice(0, MAX_L1_LENGTH);
}
