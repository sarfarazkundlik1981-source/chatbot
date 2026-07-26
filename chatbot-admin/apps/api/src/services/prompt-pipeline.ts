import type { RetrievedKnowledgeChunk } from "./retriever-service.js";

export type PromptPipelineInput = {
  systemInstructions?: string | null;
  businessContext: string;
  runtimeContext: string;
  retrievedKnowledge: RetrievedKnowledgeChunk[];
  conversationMemory?: string;
  userMessage: string;
};

export function buildPrompt(input: PromptPipelineInput) {
  const knowledgeBlock = input.retrievedKnowledge.length
    ? input.retrievedKnowledge
        .map((chunk, index) => `[${index + 1}] ${chunk.title}\n${chunk.content}`)
        .join("\n\n")
    : "No matching published knowledge was found for this question.";

  return [
    input.systemInstructions ||
      "Reply in a short, crisp, human tone. Be helpful and natural. Ask one question at a time. Use only the business context and published knowledge. Do not invent prices, services, policies, hours, or availability. If unsure, say you do not have that detail and offer to help the visitor contact the business.",
    input.businessContext ? `Business context:\n${input.businessContext}` : "",
    `Retrieved knowledge:\n${knowledgeBlock}`,
    input.conversationMemory ? `Conversation memory:\n${input.conversationMemory}` : "",
    input.runtimeContext ? `Runtime features:\n${input.runtimeContext}` : "",
    `Current user message:\n${input.userMessage}`,
    "Output constraints: Never invent pricing, services, guarantees, policies, business hours, or availability. If the retrieved knowledge does not contain the answer, say you do not have that detail and ask one focused follow-up or suggest contacting the business. Keep responses concise."
  ]
    .filter(Boolean)
    .join("\n\n");
}
