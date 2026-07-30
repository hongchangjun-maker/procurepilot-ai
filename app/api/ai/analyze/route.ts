/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiError, getD1, getEnv } from "../../../../lib/db";
import { getOpenAIKey } from "../../../../lib/secrets";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    project_name: { type: "string" },
    agency: { type: "string" },
    budget: { type: "string" },
    deadline: { type: "string" },
    purpose: { type: "string" },
    main_tasks: { type: "array", items: { type: "string" } },
    qualifications: { type: "array", items: { type: "string" } },
    required_documents: { type: "array", items: { type: "string" } },
    cautions: { type: "array", items: { type: "string" } },
    key_points: { type: "array", items: { type: "string" } },
    relevance_score: { type: "number" },
    relevance_grade: { type: "string" },
    relevance_reason: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    strategy: { type: "string" },
    priority: { type: "string" },
  },
  required: [
    "project_name", "agency", "budget", "deadline", "purpose", "main_tasks", "qualifications",
    "required_documents", "cautions", "key_points", "relevance_score", "relevance_grade",
    "relevance_reason", "strengths", "weaknesses", "strategy", "priority",
  ],
};

function outputText(data: Record<string, any>) {
  if (typeof data.output_text === "string") return data.output_text;
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") return content.text;
    }
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const { opportunityId } = await request.json() as { opportunityId?: number };
    if (!opportunityId) return Response.json({ error: "공고를 선택해 주세요." }, { status: 400 });
    const apiKey = await getOpenAIKey();
    if (!apiKey) return Response.json({ error: "OpenAI가 연결되지 않았습니다. 배포 환경에 OPENAI_API_KEY를 설정해 주세요." }, { status: 424 });
    const db = getD1();
    const opportunity = await db.prepare("SELECT * FROM opportunities WHERE id = ?").bind(opportunityId).first<Record<string, unknown>>();
    if (!opportunity) return Response.json({ error: "공고를 찾을 수 없습니다." }, { status: 404 });
    const profile = await db.prepare("SELECT * FROM business_profiles ORDER BY id DESC LIMIT 1").first<Record<string, unknown>>();
    if (!profile) return Response.json({ error: "먼저 관리자에서 내 사업 프로필을 저장해 주세요." }, { status: 409 });
    const modelSetting = await db.prepare("SELECT value_json FROM app_settings WHERE key='ai_models'").first<{ value_json: string }>();
    const models = modelSetting ? JSON.parse(modelSetting.value_json) : {};
    const model = models.relevance || getEnv().OPENAI_MODEL || "gpt-5.6-terra";
    const prompt = [
      "다음 공공 공고와 회사 프로필을 비교해 한국어로 분석하세요.",
      "근거가 없는 자격·예산·서류를 추측하지 말고 확인 불가라고 표시하세요.",
      "적합도는 제안 검토 참고자료이며 수주 가능성 보장이 아닙니다.",
      `공고: ${JSON.stringify(opportunity).slice(0, 50000)}`,
      `회사 프로필: ${JSON.stringify(profile).slice(0, 20000)}`,
    ].join("\n\n");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        input: prompt,
        text: { verbosity: "low", format: { type: "json_schema", name: "opportunity_analysis", strict: true, schema } },
      }),
    });
    const data = await response.json() as Record<string, any>;
    if (!response.ok) throw new Error(data?.error?.message || `OpenAI 응답 오류 (${response.status})`);
    const text = outputText(data);
    if (!text) throw new Error("OpenAI 응답에 분석 본문이 없습니다.");
    const analysis = JSON.parse(text);
    await db.prepare(`
      INSERT INTO ai_analyses
      (opportunity_id,summary_json,relevance_score,relevance_grade,relevance_reason,strengths,weaknesses,strategy,model_name)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(opportunity_id) DO UPDATE SET
        summary_json=excluded.summary_json,relevance_score=excluded.relevance_score,
        relevance_grade=excluded.relevance_grade,relevance_reason=excluded.relevance_reason,
        strengths=excluded.strengths,weaknesses=excluded.weaknesses,strategy=excluded.strategy,
        model_name=excluded.model_name,updated_at=CURRENT_TIMESTAMP
    `).bind(opportunityId, JSON.stringify(analysis), analysis.relevance_score, analysis.relevance_grade,
      analysis.relevance_reason, JSON.stringify(analysis.strengths), JSON.stringify(analysis.weaknesses),
      analysis.strategy, model).run();
    return Response.json({ analysis, model });
  } catch (error) {
    return apiError(error, "AI 분석에 실패했습니다.");
  }
}
