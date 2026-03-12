import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, DifficultyLevel } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateQuestions(
  courseTitle: string, 
  levelNumber: number, 
  difficulty: DifficultyLevel = 'easy',
  count: number = 19
): Promise<Question[]> {
  const diffDesc = {
    easy: "Básico e introdutório, focado em conceitos fundamentais.",
    medium: "Intermediário, exigindo aplicação de conceitos e lógica moderada.",
    hard: "Avançado e complexo, com desafios de lógica profunda e casos de borda."
  }[difficulty];

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Gere ${count} exercícios educacionais para o curso "${courseTitle}", nível ${levelNumber}.
    Dificuldade selecionada: ${difficulty.toUpperCase()} (${diffDesc}).
    
    Os exercícios devem ser variados entre:
    - Teoria (múltipla escolha)
    - Prática (múltipla escolha sobre um cenário)
    - Completar código (múltipla escolha para preencher uma lacuna em um código)
    
    Idioma: Português Brasileiro.
    
    Retorne um array JSON seguindo este esquema:
    {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "tipo": { "type": "string", "enum": ["theory", "practice", "code"] },
          "enunciado": { "type": "string" },
          "opcoes": { "type": "array", "items": { "type": "string" }, "minItems": 4, "maxItems": 4 },
          "resposta": { "type": "string" },
          "explicacao": { "type": "string" },
          "codigo": { "type": "string", "description": "Opcional, apenas para o tipo 'code'" }
        },
        "required": ["tipo", "enunciado", "opcoes", "resposta", "explicacao"]
      }
    }`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            tipo: { type: Type.STRING },
            enunciado: { type: Type.STRING },
            opcoes: { type: Type.ARRAY, items: { type: Type.STRING } },
            resposta: { type: Type.STRING },
            explicacao: { type: Type.STRING },
            codigo: { type: Type.STRING }
          },
          required: ["tipo", "enunciado", "opcoes", "resposta", "explicacao"]
        }
      }
    }
  });

  const questions = JSON.parse(response.text);
  return questions.map((q: any, index: number) => ({
    ...q,
    id: `gen-${courseTitle}-${levelNumber}-${index}`,
    levelId: `${courseTitle}-level-${levelNumber}`
  }));
}
