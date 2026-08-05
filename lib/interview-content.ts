import "server-only";

import fs from "node:fs";
import path from "node:path";

export type InterviewQuestion = {
  id: string;
  number: number;
  displayNumber?: string;
  category: string;
  question: string;
  englishQuestion: string;
  summary: string;
  keywords: string[];
  englishKeywords: string[];
  answer: string;
  englishKeyPoint: string;
  englishAnswer: string;
  core: boolean;
  sources?: ("OFFICIAL" | "APPLICATION" | "ALUMNI" | "FOLLOW-UP")[];
  priority?: "S" | "A" | "B";
  readiness?: "ready" | "partial" | "recover";
  speakable?: boolean;
  practiceLanguage?: "ko" | "en";
  audioLanguages?: ("ko" | "en")[];
};

export type ResearchStage = {
  id: string;
  title: string;
  time: string | null;
  korean: string;
  english: string;
  keywords: string[];
  englishKeywords: string[];
};

export type InterviewContent = {
  questions: InterviewQuestion[];
  coreQuestions: InterviewQuestion[];
  researchDefenseQuestions: InterviewQuestion[];
  applicationQuestions: InterviewQuestion[];
  researchStages: ResearchStage[];
  sourcePath: string;
  loadedFromLocalNotionMirror: boolean;
};

const applicationClusterOrder = [
  "0. Opening",
  "1. Motivation & BTM Fit",
  "2. Career Journey",
  "3. My Weapon",
  "4. Undergraduate & Activities",
  "5. Academic Record & Weakness",
  "6. Projects & Technical Credibility",
  "7. Person & Research Life",
] as const;

type ApplicationCluster = (typeof applicationClusterOrder)[number];

const BUNDLED_CONTENT_PATH = path.join(
  process.cwd(),
  "data",
  "interview",
  "content.json"
);

const fallbackQuestions: InterviewQuestion[] = [
  {
    id: "fallback-1",
    number: 1,
    category: "자기소개 · 지원동기",
    question: "왜 KAIST BTM입니까?",
    englishQuestion: "Why KAIST BTM?",
    summary: "현장의 질문을 검증 가능한 연구로 전환하기 위해서다.",
    keywords: ["실무 경험", "연구방법론", "Organizational AI", "Faculty fit"],
    englishKeywords: ["field experience", "research methods", "organizational AI", "faculty fit"],
    answer:
      "제가 원하는 것은 일반적인 경영지식의 보강이 아니라 현장에서 얻은 질문을 검증 가능한 연구로 바꾸는 훈련입니다.",
    englishKeyPoint: "Research-method and faculty fit.",
    englishAnswer:
      "What I need is training that can turn questions from practice into testable research.",
    core: true,
  },
];

const fallbackResearch: ResearchStage[] = [
  {
    id: "fallback-research",
    title: "연구 핵심 한 문장",
    time: null,
    korean:
      "업무용 RAG의 지식구조와 검증 설계가 도메인 전문가의 검증행동과 적정 의존에 미치는 영향을 연구한다.",
    english:
      "Study how knowledge representation and verification design affect calibrated reliance in workplace RAG.",
    keywords: ["Knowledge structure", "Verification", "Calibrated reliance"],
    englishKeywords: ["knowledge representation", "verification design", "calibrated reliance"],
  },
];

const researchKeywordOverrides: Record<
  string,
  { korean: string[]; english: string[] }
> = {
  "발표 핵심 한 문장": {
    korean: ["업무용 RAG", "지식 구조화", "출처·최신성·불확실성", "검증 행동", "적정 의존", "의사결정 품질"],
    english: ["workplace RAG", "knowledge representation", "provenance · freshness · uncertainty", "verification behavior", "calibrated reliance", "decision quality"],
  },
  "문제 배경 / Problem": {
    korean: ["근거가 약한 답", "과신", "검증 가능성", "적정 의존"],
    english: ["weakly supported answers", "over-reliance", "verifiability", "calibrated reliance"],
  },
  "개인적 출발점 / Personal starting point": {
    korean: ["GfK 시장 데이터", "우수살롱 현장지식", "AskOosu 근거 부족", "정보 구조와 판단"],
    english: ["GfK market data", "Oosu Salon tacit knowledge", "AskOosu insufficient evidence", "information structure and judgment"],
  },
  "연구질문 / Research question": {
    korean: ["지식 구조", "검증 설계", "검증 행동", "적정 의존", "의사결정 품질"],
    english: ["knowledge structure", "verification design", "verification behavior", "calibrated reliance", "decision quality"],
  },
  "문헌 공백 / Literature gap": {
    korean: ["투명성·신뢰·수용", "실제 검증 행동", "조직 업무", "지식 구조와 행동의 연결"],
    english: ["transparency · trust · adoption", "actual verification behavior", "organizational work", "knowledge structure and behavior"],
  },
  "논증·가설 / Argument": {
    korean: ["투명성만으로 부족", "검증 통제", "workflow fit", "전문성", "시간 압박"],
    english: ["transparency is insufficient", "verification controls", "workflow fit", "expertise", "time pressure"],
  },
  "방법론 / Method": {
    korean: ["탐색적 인터뷰", "RAG 프로토타입", "통제실험", "설문·행동로그", "과업 성과", "동일 출력 통제"],
    english: ["exploratory interviews", "RAG prototype", "controlled experiment", "survey · behavioral logs", "task performance", "controlled output"],
  },
  "학술·실무 기여 / Contribution": {
    korean: ["지식표상", "조직의 주의와 책임", "검증 가능한 RAG", "설계 원칙"],
    english: ["knowledge representation", "organizational attention and responsibility", "verifiable RAG", "design principles"],
  },
  "실행 가능성·로드맵 / Feasibility": {
    korean: ["하나의 업무", "두 조작요인", "4학기 로드맵", "석사 범위"],
    english: ["one task", "two design factors", "four-semester roadmap", "master's scope"],
  },
  "BTM·연구실 적합성 / BTM and faculty fit": {
    korean: ["연구방법론", "디지털혁신", "기술혁신전략", "조직 AI", "교수 연구 접점"],
    english: ["research methods", "digital innovation", "technology strategy", "organizational AI", "faculty fit"],
  },
  "결론 / Conclusion": {
    korean: ["현장 경험", "검증 가능한 연구", "조직 AI", "적절한 의존"],
    english: ["field experience", "testable research", "organizational AI", "appropriate reliance"],
  },
  "발표 첫 문장 / Opening sentence": {
    korean: ["기업의 RAG 도입", "근거가 약한 답", "너무 쉽게 믿는 것"],
    english: ["RAG adoption", "weak evidence", "trust too easily"],
  },
  "발표 마지막 문장 / Closing sentence": {
    korean: ["시장데이터·현장 운영·RAG", "더 많이 사용", "더 정확하게 검증", "적절히 의존"],
    english: ["market data · field operations · RAG", "use AI more", "verify more accurately", "rely appropriately"],
  },
};

const researchPresentationSpokenOverrides: Record<string, string> = {
  "발표 핵심 한 문장":
    "저는 업무용 RAG에서 조직의 문서와 운영지식을 어떻게 연결하고, 사용자가 답의 근거를 얼마나 쉽게 확인할 수 있게 하느냐가 실제 검증 행동에 어떤 영향을 주는지 연구하고 싶습니다. 특히 출처, 최신성, 불확실성 같은 정보를 어떻게 보여줄 때 사용자가 AI의 답을 더 정확하게 확인하고 적절하게 활용하는지 보고자 합니다.",
  "발표 첫 문장 / Opening sentence":
    "기업이 검색증강생성, 즉 RAG 기반 AI를 도입할 때 위험한 것은 사용자가 AI를 믿지 않는 것만이 아닙니다. 근거가 약한 답을 너무 쉽게 믿는 것도 큰 문제입니다.",
  "문제 배경 / Problem":
    "그래서 기업에서 중요한 것은 단순히 AI의 답변 정확도를 높이는 것만은 아니라고 생각합니다. 실제 업무에서는 근거가 약한 답을 그대로 믿는 것도 위험하고, 반대로 쓸 만한 답까지 불신해서 활용하지 않는 것도 문제입니다. 저는 사용자가 AI를 더 많이 믿게 만드는 것보다, 답의 근거를 확인하고 상황에 맞게 적절히 활용할 수 있게 만드는 조건에 관심이 있습니다.",
  "개인적 출발점 / Personal starting point":
    "이 문제의식은 세 가지 경험에서 시작됐습니다. GfK에서는 같은 시장 데이터라도 어떤 기준으로 정리하고 보여주느냐에 따라 실제 의사결정에 쓰이는 방식이 달라지는 것을 봤습니다. 이후 우수살롱을 운영하면서는 문서로 다 설명하기 어려운 현장지식과 예외 상황이 판단에 큰 영향을 준다는 것을 배웠습니다. 최근 AskOosu를 직접 만들면서는 AI가 자연스럽게 답하는 것보다, 어떤 자료를 근거로 했는지 보여주고 정보가 부족할 때 그 한계를 드러내는 것이 더 중요할 수 있다는 점을 경험했습니다.",
  "연구질문 / Research question":
    "그래서 제 연구질문은 크게 두 가지입니다. 첫째, 업무용 RAG에서 조직의 문서와 운영지식을 어떻게 연결하고, 출처와 최신성, 불확실성 같은 정보를 어떻게 보여주느냐에 따라 사용자의 실제 검증 행동이 달라지는지 보고 싶습니다. 둘째, 그런 검증 행동이 AI의 답이 맞을 때는 활용하고, 의심스러울 때는 다시 확인하거나 거부하는 적정 의존으로 이어지는지 보겠습니다. 그리고 그 결과 최종 의사결정의 질도 높아지는지 확인하고 싶습니다.",
  "문헌 공백 / Literature gap":
    "기존 연구는 크게 세 흐름으로 나눠볼 수 있습니다. 첫째, Tom Steinberger 교수님의 연구처럼 도메인 전문가가 실제 업무에서 데이터를 어떻게 해석하고 사용하는지를 다룬 연구가 있습니다. 둘째, 사람이 AI의 설명과 투명성을 어떻게 받아들이고, 언제 AI를 신뢰하거나 의심하는지를 다룬 연구가 있습니다. 셋째, RAG와 대규모 언어모델에서 인용과 출처 추적의 품질을 높이는 기술 연구도 빠르게 발전하고 있습니다. 하지만 조직의 지식구조와 검증 인터페이스를 함께 바꿔가며, 사용자가 실제로 출처를 열고 비교하거나 AI의 답을 수정·거부하는 행동까지 측정한 연구는 아직 충분하지 않다고 봅니다. 저는 이 세 흐름을 실제 조직 업무 안에서 연결하고 싶습니다.",
  "논증·가설 / Argument":
    "제 기본 가설은 정보를 많이 보여주는 것만으로는 충분하지 않다는 것입니다. 출처나 불확실성 표시가 있어도 업무 흐름 안에서 확인하기 어렵다면 실제 검증으로 이어지지 않을 수 있습니다. 반대로 필요한 순간에 원문을 바로 열어보거나 답변의 근거를 비교할 수 있게 하면 과신을 줄이는 데 도움이 될 수 있습니다. 또 같은 기능이라도 사용자의 전문성이나 시간 압박에 따라 효과가 다르게 나타날 수 있다고 생각합니다.",
  "방법론 / Method":
    "연구는 크게 세 단계로 진행하고 싶습니다. 먼저 실제 업무에서 AI를 사용하는 실무자들을 인터뷰해서 언제 답을 다시 확인하는지, 또 어떤 정보가 있어야 검증하기 쉬운지를 파악하겠습니다. 두 번째로 같은 문서와 같은 AI 답변을 사용하되, 출처와 최신성을 보여주는 방식이나 원문 확인 기능만 다르게 한 RAG 프로토타입을 만들겠습니다. 세 번째로 참가자들이 실제 업무와 비슷한 과업을 수행하게 하고, 출처를 실제로 열어봤는지, 답변을 수정했는지, 잘못된 답을 거부했는지 같은 행동을 측정하겠습니다. 마지막으로 과업 정확도와 의사결정 품질을 함께 비교해서 어떤 설계가 단순히 신뢰를 높이는 것이 아니라 적정 의존을 만드는지 확인하고 싶습니다. 모델 성능 자체의 영향은 줄이기 위해 실험 조건마다 같은 AI 답변을 고정하고, 정보 제시 방식만 바꾸는 방향으로 설계하겠습니다.",
  "학술·실무 기여 / Contribution":
    "학술적으로는 RAG의 지식구조와 인터페이스 설계를 단순한 기술 선택으로만 보지 않고, 조직 구성원이 무엇을 확인하고 누가 최종적으로 책임을 지는지와 연결해 설명하고 싶습니다. 또 신뢰를 높이는 것 자체보다 실제 검증 행동과 적정 의존을 함께 측정한다는 점에서 기존 연구를 보완할 수 있다고 생각합니다. 실무적으로는 별도의 AI 검증 인력을 두기 어려운 중소기업에서도 활용할 수 있도록, 어떤 정보를 어떤 방식으로 보여줘야 하는지 구체적인 RAG 설계 원칙을 제안하고 싶습니다.",
  "실행 가능성·로드맵 / Feasibility":
    "석사과정 안에서 실행할 수 있도록 연구범위는 의도적으로 좁히겠습니다. 처음부터 여러 산업과 여러 직무를 비교하기보다 하나의 업무과업을 정하고, 출처를 보여주는 방식과 검증 기능처럼 두 가지 정도의 핵심 요소에 집중하겠습니다. 1학기에는 연구방법론과 선행연구를 정리하고, 2학기에는 인터뷰와 프로토타입 설계, 3학기에는 실험과 분석, 4학기에는 추가 검증과 논문 작성을 진행하는 방향을 생각하고 있습니다. 연구 과정에서 더 중요한 질문이 발견되면 지도교수님과 상의해 변수와 범위를 조정하겠습니다.",
  "BTM·연구실 적합성 / BTM and faculty fit":
    "이 연구를 제대로 하려면 제가 아직 부족한 연구설계와 계량 방법을 먼저 보완해야 한다고 생각합니다. 카이스트 BTM의 연구방법론과 디지털혁신 관련 과목을 통해 그 기반을 쌓고 싶습니다. 제 연구와 가장 직접적으로 연결되는 분은 Tom Steinberger 교수님입니다. 교수님은 도메인 전문가가 실제 현장에서 데이터를 어떻게 사용하고, 분석 결과가 어떻게 실제 행동으로 이어지는지를 연구해 왔습니다. 저는 이 문제를 생성형 AI와 업무용 RAG로 확장해서, 도메인 전문가가 AI의 답을 실제로 검증하고 활용하는 조건을 연구하고 싶습니다. 조항정 교수님의 AI 투명성과 사용자 반응 연구는 검증 정보가 사람의 판단에 어떤 영향을 주는지 설명하는 데 도움이 될 수 있고, 정현주 교수님의 지식탐색과 기술혁신 연구는 조직이 기존 지식과 새로운 AI 역량을 어떻게 결합하는지 보는 전략적 관점을 보완해 줄 수 있다고 생각합니다. 다만 석사논문에서는 범위를 넓히기보다 Tom 교수님 연구와 가장 직접적으로 맞닿는 검증 행동과 업무 흐름의 적합성에 집중하고 싶습니다.",
  "결론 / Conclusion":
    "정리하면, 저는 시장 데이터 분석과 사업 운영, 그리고 RAG 구현을 거치면서 조직에서 정보와 AI가 실제 판단으로 이어지는 과정에 관심을 갖게 됐습니다. 카이스트 BTM에서는 이 관심을 개인 경험에서 나온 주장에 그치지 않고, 지식구조와 검증 설계가 사람의 행동과 의사결정에 어떤 영향을 주는지 데이터로 검증하는 연구로 발전시키고 싶습니다.",
  "발표 마지막 문장 / Closing sentence":
    "저는 시장 데이터, 현장 운영, 정보구조와 RAG 구현 경험을 바탕으로, 사람들이 AI를 무조건 더 많이 쓰게 만드는 연구가 아니라 필요한 순간에는 활용하고 의심스러울 때는 제대로 검증할 수 있게 만드는 연구를 카이스트 BTM에서 수행하고 싶습니다.",
};

const researchDefenseSpokenOverrides: Record<number, string> = {
  11: "저는 업무용 RAG에서 조직의 문서와 운영지식을 어떻게 연결하고, 출처와 최신성, 불확실성 같은 검증 정보를 어떻게 보여주느냐가 사용자의 실제 검증 행동과 적정 의존, 그리고 최종 의사결정에 어떤 영향을 주는지 연구하고 싶습니다.",
  12: "핵심 문제의식은 같습니다. 지원서에서는 출처 투명성과 오류 처리, 업무 적합성이 신뢰와 지속사용에 어떤 영향을 주는지를 넓게 제시했습니다. 이후 문헌을 더 보면서 단순히 신뢰를 높이는 것보다, 사용자가 AI의 답을 실제로 확인하고 맞을 때는 활용하며 틀릴 때는 거부할 수 있는지가 더 중요하다고 판단했습니다. 그래서 연구 맥락을 조직 업무용 RAG로 좁히고, 핵심 결과도 검증 행동과 적정 의존으로 구체화했습니다.",
  13: "크게 세 가지를 보고 싶습니다. 첫째, 출처와 최신성, 불확실성을 명확하게 보여주면 사용자가 실제로 답을 더 많이 검증하는지 보겠습니다. 둘째, 원문을 바로 열어보거나 답을 다시 물어보고 수정·승인할 수 있는 기능이 적정 의존과 의사결정의 질을 높이는지 보겠습니다. 셋째, 사용자의 전문성과 시간 압박에 따라 이런 효과가 달라지는지도 확인하고 싶습니다.",
  14: "설명가능성이나 투명성, 신뢰, 기술수용에 관한 연구는 이미 많이 있습니다. 다만 많은 연구가 신뢰나 사용의도를 설문으로 측정하거나, 인터페이스와 조직의 지식구조를 따로 보는 경우가 많습니다. 업무용 RAG에서는 어떤 정보가 검색돼 공식적인 근거처럼 제시되는지와 사용자가 그 정보를 실제로 어떻게 확인하는지가 동시에 중요합니다. 저는 이 두 요소가 출처 클릭, 교차확인, 정답 수용과 오답 거부 같은 실제 행동을 통해 적정 의존으로 이어지는 과정을 보고 싶습니다. 물론 구체적인 공백은 입학 후 체계적인 문헌검토를 통해 더 정확히 확정하겠습니다.",
  15: "제 기본 가설은 투명성을 높이는 것만으로는 충분하지 않다는 것입니다. 사용자가 실제로 원문을 확인하거나 답을 수정할 수 있는 기능이 같이 있을 때 적정 의존으로 이어질 가능성이 더 높다고 봅니다. 반대로 출처와 최신성 정보를 너무 많이 보여주면 오히려 인지부담이 생길 수도 있습니다. 결국 어떤 정보를 얼마나 쉽게 확인할 수 있게 하느냐가 중요하고, 그 효과는 사용자의 전문성과 시간 압박에 따라서도 달라질 수 있다고 생각합니다.",
  16: "신뢰를 무조건 높이는 것은 오히려 위험할 수 있습니다. 틀린 답까지 그대로 믿으면 과의존이 생기기 때문입니다. 제가 원하는 것은 사용자가 AI를 많이 믿는 상태가 아니라, AI의 답이 맞을 때는 효율적으로 활용하고 근거가 약하거나 틀렸을 때는 다시 확인하거나 거부하는 상태입니다. 그래서 신뢰 자체보다 정답 수용률, 오답 거부율, 출처 확인 행동과 최종 의사결정 품질을 더 중요하게 보고 싶습니다.",
  17: "두 단계의 혼합연구를 생각하고 있습니다. 먼저 지식노동자나 도메인 실무자를 인터뷰해서 실제로 어떤 상황에서 AI의 답을 다시 확인하는지 파악하겠습니다. 그 결과를 바탕으로 출처와 최신성을 얼마나 쉽게 확인할 수 있는지, 그리고 원문 확인이나 수정 기능을 어느 정도 제공할지를 달리한 RAG 프로토타입을 만들고 통제실험을 진행하겠습니다. 필요한 표본 수는 실험설계를 정한 뒤 통계적으로 계산하고, 설문뿐 아니라 출처 클릭, 검토시간, 오답 거부율과 최종 과업성과 같은 행동 데이터를 핵심 자료로 보겠습니다.",
  18: "독립변수는 크게 두 가지입니다. 첫째는 출처와 최신성, 불확실성 정보를 얼마나 명확하게 보여주는지이고, 둘째는 원문 확인이나 되묻기, 수정과 승인 같은 검증 기능을 어느 정도 제공하는지입니다. 종속변수는 실제 출처 확인 횟수와 시간, 교차확인 여부, 정답을 받아들이고 오답을 거부하는 비율, 그리고 최종 의사결정 정확도와 과업시간입니다. 신뢰나 정보품질, 인지부담, 지속사용 의도는 보조적으로 함께 보겠습니다.",
  19: "현재 특정 기업의 참여가 확정된 것은 아닙니다. 처음부터 모집하기 어려운 고숙련 전문가만 대상으로 하면 석사연구의 실행 가능성이 떨어질 수 있습니다. 그래서 탐색 인터뷰는 제 업무와 창업 네트워크의 지식노동자와 중소기업 실무자에게 요청하고, 실험은 일정 수준의 직무경험을 가진 온라인 패널까지 확장하는 방안을 생각하고 있습니다. 입학 후 지도교수님과 상의해 연구 맥락을 하나로 좁히고, 협력기관이 확보되면 현장 타당성을 보완하겠습니다.",
  20: "실험에서는 모델이 매번 자유롭게 다른 답을 만들게 두기보다, 같은 질문에 같은 정답이나 오답과 같은 근거 문서를 제시하도록 통제하는 것이 적절하다고 생각합니다. 그래야 모델 자체의 성능 차이가 아니라 출처와 최신성 표시, 검증 기능의 효과를 분리해서 볼 수 있습니다. 이후에는 실제 시스템 로그를 이용한 후속 연구로 현장에서도 같은 효과가 나타나는지 확인할 수 있습니다.",
  21: "출처정보를 보여줬는데도 검증이 늘지 않거나 오히려 성과가 떨어진다면 그것도 중요한 결과라고 생각합니다. 정보가 너무 많아서 부담이 커졌는지, 사용자가 출처의 품질을 판단하기 어려웠는지, 또는 시간 압박 때문에 확인하지 않았는지를 추가로 분석할 수 있습니다. 중요한 것은 투명성이 항상 좋다는 결론을 미리 정하는 것이 아니라, 어떤 조건에서 효과가 나타나고 언제 사라지는지를 설명하는 것입니다.",
  22: "그 지적에 동의합니다. 지원서에는 기술수용모형, 즉 TAM과 신뢰 이론을 출발점으로 적었습니다. 하지만 지각된 유용성과 사용용이성만으로는 사용자가 실제로 AI의 답을 검증하는 행동이나 과의존을 충분히 설명하기 어렵습니다. 최종 연구에서는 기본적인 기술수용 변수는 참고하되, 자동화 신뢰와 적정 의존, 사람과 AI의 협업, 조직의 업무 루틴과 지식구조에 관한 연구를 함께 검토하겠습니다. 또 사용의도만 설문으로 묻지 않고 실제 행동과 과업성과를 측정하겠습니다.",
  23: "첫째, RAG의 메타데이터와 출처·최신성 설계를 단순한 기술 설정이 아니라 조직이 어떤 정보를 공식적인 지식으로 보고 어디에 주의를 기울이는지를 바꾸는 구조로 설명할 수 있습니다. 둘째, 단순히 신뢰가 높아졌는지가 아니라 실제 검증 행동과 적정 의존이 어떻게 달라지는지를 보여줄 수 있습니다. 셋째, 사용자의 전문성이나 시간 압박 같은 조직 맥락에 따라 효과가 달라지는 조건을 제시할 수 있다고 생각합니다.",
  24: "중소기업은 별도의 AI 검증 인력을 두기 어려운 경우가 많습니다. 그래서 제품 안에서 누가 언제 무엇을 확인해야 하는지를 쉽게 알 수 있게 설계하는 것이 중요합니다. 연구 결과를 바탕으로 어떤 출처정보를 먼저 보여줘야 하는지, 언제 불확실성을 알려줘야 하는지, 원문 확인이나 승인 절차를 업무 흐름 안에 어떻게 넣어야 하는지 구체적인 설계 원칙을 제안하고 싶습니다. 이런 기준이 실제 AI 도입의 비용과 위험을 줄이는 데 도움이 될 수 있다고 생각합니다.",
  25: "넓게 잡으면 어렵다고 생각합니다. 그래서 석사논문에서는 하나의 지식업무를 선택하고, 출처와 최신성을 보여주는 방식과 검증 기능 정도로 핵심 변수를 제한하려 합니다. 1학기에는 문헌검토와 인터뷰, 2학기에는 프로토타입과 파일럿, 3학기에는 본 실험과 분석, 4학기에는 보완 분석과 논문 작성을 진행하는 방향입니다. 실제 범위는 입학 후 지도교수님과 데이터 접근 가능성을 기준으로 더 줄이겠습니다.",
  26: "첫 학기에는 고급통계와 연구방법론을 보완하면서 AI 신뢰와 적정 의존, 조직지식과 업무 루틴에 관한 문헌을 체계적으로 검토하겠습니다. 동시에 탐색 인터뷰로 실제 검증 행동을 파악하겠습니다. 두 번째 학기에는 연구모형과 실험 조건을 확정하고 RAG 프로토타입으로 파일럿을 진행하겠습니다. 세 번째 학기에는 본 실험과 분석을 하고, 마지막 학기에는 추가 분석과 논문 작성, 가능하다면 학회 발표나 투고까지 이어가고 싶습니다.",
  27: "초기 통제실험에서는 실제 기업 기밀 대신 합성하거나 비식별화한 문서와 과업을 사용하겠습니다. 현장자료를 쓰게 된다면 연구목적에 필요한 최소한의 로그만 수집하고, 개인식별정보와 업무내용을 분리해서 보관하겠습니다. 또 접근권한과 보관기간을 명확히 하고, 필요한 경우 연구윤리심의, 즉 IRB 절차를 먼저 거치겠습니다.",
  28: "현재 연구질문과 가장 직접적으로 맞는 분은 Tom Steinberger 교수님이라고 생각합니다. 교수님은 도메인 전문가가 실제 현장에서 데이터를 어떻게 사용하고, 분석 결과가 실제 행동으로 이어지려면 무엇이 필요한지를 연구해 왔습니다. 이 점이 제가 관심 있는 조직지식 구조와 검증 행동 문제와 직접 연결됩니다. 정현주 교수님의 지식탐색과 기술혁신전략 연구는 외부 지식과 기존 역량을 어떻게 결합하는지 보는 전략적 관점을 보완하고, 조항정 교수님의 IT경영과 디지털 비즈니스 연구는 조직의 기술 채택과 정보품질 관점을 보완할 수 있다고 생각합니다. 다만 특정 교수님 한 분만을 전제로 하기보다 입학 후 연구주제와 실제 지도 가능성을 함께 확인해 결정하고 싶습니다.",
  29: "네. 제 연구주제가 교수님들의 연구와 실제로 맞는지 확인하기 위해 조항정, 정현주, 김원준, Tom Steinberger 교수님과 소통했습니다. Tom 교수님은 제 주제와 준비가 잘 맞고 입학하면 지도할 의향이 있다고 답해주셨지만, 본인은 입학심사위원이 아니고 입학전형은 별개라고 명확히 말씀하셨습니다. 정현주 교수님도 연구 아이디어가 더 발전하면 연구실과 맞을 수 있고 합격 후 구체적으로 이야기하자고 하셨습니다. 저는 이런 답변을 합격 신호라기보다 연구계획을 더 정확히 다듬는 데 도움이 된 피드백으로 보고 있습니다.",
  30: "김원준 교수님께는 자동화가 고용과 창업 경로에 미치는 연구를 제 창업 경험과 연결해서 문의드렸습니다. 교수님은 연구 연결 자체는 긍정적으로 봐주셨지만 외부 기관 근무 때문에 직접 지도는 어렵다고 알려주셨습니다. 그래서 희망 지도교수로 전제하고 있지는 않습니다. 다만 그 논문을 읽는 과정은 제 개인 경험을 바로 일반화하지 않고, 변수를 구분하고 다른 설명 가능성을 생각하는 연구질문으로 바꾸는 데 도움이 됐습니다.",
  31: "여러 번 주제를 바꾼 것이 아니라 같은 문제를 어떤 관점에서 설명할 수 있는지 확인한 과정입니다. 공통된 질문은 AI와 외부 지식이 조직에 들어올 때 어떻게 구조화되고, 누가 어떻게 검증하며, 실제 가치로 이어지는가였습니다. 현재는 석사 수준에서 다룰 수 있도록 조직 업무용 RAG의 지식구조와 검증 행동으로 범위를 좁혔습니다. 다른 교수님들의 연구는 혁신전략이나 디지털 비즈니스 관점을 보완하는 역할로 보고 있습니다.",
  38: "정확도가 높아지는 것은 가장 기본적인 조건이지만 그것만으로 충분하지는 않다고 생각합니다. 조직의 지식은 계속 바뀌고, 같은 답이라도 출처가 공식적인지, 얼마나 신뢰할 수 있는지, 얼마나 최신인지에 따라 실제 업무에서 쓸 수 있는지가 달라집니다. 오히려 매우 정확한 모델일수록 사용자가 무비판적으로 의존할 위험도 있습니다. 그래서 성능 개선과 함께 사용자가 근거와 한계를 확인하고, 누가 최종적으로 승인하고 책임지는지도 설계해야 한다고 생각합니다.",
  70: "맞습니다. 제 경험만으로 일반화하면 연구가 아니라 개인적인 사례나 의견에 머뭅니다. 그래서 경험은 연구현상을 발견한 출발점으로만 쓰고, 문헌을 통해 기존 설명과 공백을 확인한 뒤 실제로 측정하고 반박할 수 있는 가설로 바꾸려 합니다. 통제실험과 행동 데이터를 통해 제 경험과 반대되는 결과가 나와도 받아들일 수 있게 설계하겠습니다.",
  71: "생성형 AI가 최근의 계기가 된 것은 맞습니다. 하지만 데이터 구조가 의사결정을 바꾼다는 문제는 GfK에서, 문서로 설명하기 어려운 현장지식과 예외처리는 우수살롱에서, 정보구조와 사용자 탐색 문제는 Sticks & Stones에서 이미 경험했습니다. RAG는 이런 문제가 한 시스템 안에서 동시에 드러나는 연구 대상이라고 생각합니다. 기술 유행 자체보다 조직이 무엇을 지식으로 인정하고 누가 그것을 검증하는가라는 더 오래가는 질문에 관심이 있습니다.",
  72: "맞습니다. 지금 제시한 것은 연구의 전체 방향이고, 석사논문 범위는 더 좁혀야 합니다. 석사논문에서는 하나의 지식업무를 선택하고, 출처와 최신성을 보여주는 방식과 검증 기능 정도로 독립변수를 제한하겠습니다. 핵심 결과도 실제 검증 행동과 적정 의존, 과업 정확도로 좁히겠습니다. 조직전략과 사업화는 논문의 직접 결과변수라기보다 연구 결과가 실제로 어떤 의미를 갖는지 설명하는 부분으로 두겠습니다.",
  73: "단순히 AI라는 단어가 겹친다고 연결한 것은 아닙니다. 예를 들어 Tom Steinberger 교수님의 연구는 데이터 모델이 현실을 그대로 옮기는 것이 아니라, 조직 구성원이 무엇을 보고 어떤 역할을 맡게 되는지에도 영향을 줄 수 있다는 점을 보여줍니다. AskOosu를 만들 때도 메타데이터와 최신성, 문서분류를 어떻게 설정하느냐에 따라 사용자가 보게 되는 근거가 달라졌습니다. 저는 이런 기술적 선택이 실제 검증 행동과 책임 분담에 어떤 영향을 주는지 실증적으로 보고 싶습니다.",
  74: "석사과정에서는 학술연구가 우선입니다. 제품에 유리한 결론을 미리 정해놓고 연구를 그 근거로 사용하는 방식은 피하겠습니다. 먼저 어떤 설계가 어떤 과정을 통해 사람의 행동과 성과에 영향을 주는지 검증하고, 결과가 충분히 견고할 때 중소기업용 AI 서비스나 도입지침으로 적용할 수 있는지를 논의하겠습니다.",
};

const unspeakableApplicationNumbers = new Set([
  107, 108, 109, 110, 111, 112,
]);

const applicationSpokenOverrides: Record<number, string> = {
  5: "제가 원하는 것은 일반적인 경영지식을 더 배우는 것보다, 현장에서 얻은 질문을 검증 가능한 연구로 바꾸는 훈련입니다. KAIST BTM에는 연구방법론과 디지털혁신, 기술혁신전략, 데이터 분석 관련 과목이 있어 제가 부족한 연구설계와 계량 역량을 보완하면서 조직 AI 문제를 다룰 수 있습니다. 또 조직의 데이터 활용과 AI 기반 지식업무, 지식탐색과 디지털 비즈니스를 연구하는 교수진과 제 경험의 접점도 분명합니다. 그래서 학교의 이름 자체보다 연구주제와 교과과정의 적합성이 지원한 가장 큰 이유입니다.",
  61: "저는 시장데이터, 소상공인 운영, 웹 정보구조, RAG 구현을 모두 경험해서 현장 문제를 데이터와 사용자, 기술의 관점에서 함께 볼 수 있습니다. 연구실에서는 조직과 실무자의 문제를 인터뷰와 실제 과업으로 구체화하고, 필요하면 연구용 프로토타입까지 직접 만드는 데 기여할 수 있습니다. 또 창업과 프로젝트 경험을 동료들과 공유하면서 연구 아이디어가 실제 업무에서 어떤 제약을 만나는지도 함께 검토하고 싶습니다.",
  101: "제 강점은 경영 문제를 데이터로 구조화하고, 현장을 이해한 뒤 필요하면 직접 기술로 구현해서 검증할 수 있다는 점입니다. GfK에서는 데이터를 다뤘고, 우수살롱에서는 실제 운영을 했으며, 최근에는 AskOosu 같은 RAG 서비스를 직접 만들었습니다. 이 세 경험을 연결해서 문제를 정의하고 실행까지 가져갈 수 있다는 것이 제 나만의 무기라고 생각합니다.",
  105: "Sticks & Stones는 시장분석과 사업 운영 이후에 제가 기술과 제품 구현 역량을 실제 업무에서 사용한 가장 최근 경력입니다. 특히 사용자가 회사의 서비스와 사례를 더 쉽게 이해할 수 있도록 정보구조와 웹서비스를 개선하는 과정에 참여했고, 기획과 구현을 연결한 경험이라는 점에서 대표경력으로 선택했습니다.",
  117: "공식 제출점수는 2025년 TOEIC 925점입니다. TOEIC 990점과 OPIc AL은 과거에 취득한 성적입니다. 영어 논문을 읽고 수업에 참여하는 데는 자신이 있고, 실제 면접에서도 영어 질문을 받으면 현재 수준으로 직접 답변드리겠습니다.",
};

function stripMarkdown(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^>\s?/gm, "")
    .trim();
}

function normalizeQuestion(value: string) {
  return value
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, "")
    .trim();
}

function bigrams(value: string) {
  const normalized = normalizeQuestion(value);
  if (normalized.length < 2) return [normalized];
  return Array.from({ length: normalized.length - 1 }, (_, index) =>
    normalized.slice(index, index + 2)
  );
}

function diceSimilarity(a: string, b: string) {
  const aPairs = bigrams(a);
  const bPairs = bigrams(b);
  const counts = new Map<string, number>();
  for (const pair of aPairs) counts.set(pair, (counts.get(pair) ?? 0) + 1);
  let intersection = 0;
  for (const pair of bPairs) {
    const count = counts.get(pair) ?? 0;
    if (count > 0) {
      intersection += 1;
      counts.set(pair, count - 1);
    }
  }
  return (2 * intersection) / Math.max(1, aPairs.length + bPairs.length);
}

function deriveKeywords(summary: string) {
  const pieces = summary
    .replace(/[.!?]$/g, "")
    .split(/\s*(?:→|·|,| 그리고 | 하지만 | 때문에 | 통해 |에서 )\s*/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  if (pieces.length >= 2) return pieces.slice(0, 5);
  return summary ? [summary] : [];
}

function deriveEnglishKeywords(value: string) {
  const cleaned = value
    .replace(/[.!?]$/g, "")
    .replace(/^(key point|answer)\s*[:·-]?\s*/i, "")
    .trim();

  if (!cleaned) return [];

  const pieces = cleaned
    .split(/\s*(?:→|,|;|\band\b|\bbut also\b|\bwhile\b|\bthen\b|\bto\b)\s*/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)
    .map((item) => item.replace(/^(connect|explain|study|show|present|demonstrate)\s+/i, ""));

  if (pieces.length >= 2) return pieces.slice(0, 5);

  const words = cleaned.split(/\s+/);
  if (words.length <= 7) return [cleaned];

  const chunkSize = Math.ceil(words.length / 3);
  return [
    words.slice(0, chunkSize).join(" "),
    words.slice(chunkSize, chunkSize * 2).join(" "),
    words.slice(chunkSize * 2).join(" "),
  ].filter(Boolean);
}

function parseCoreCueFile(markdown: string) {
  const result: { question: string; englishQuestion: string; keywords: string[] }[] = [];
  const chunks = markdown.split(/\n(?=### Card \d+)/g);

  for (const chunk of chunks) {
    const question = chunk.match(/\*\*Q\.\s*(.+?)\*\*/)?.[1]?.trim();
    const englishQuestion = chunk.match(/\nEN\.\s*(.+)/)?.[1]?.trim();
    const cue = chunk.match(/\*\*Cue:\*\*\s*(.+)/)?.[1]?.trim();
    if (!question || !cue) continue;
    result.push({
      question,
      englishQuestion: englishQuestion ?? "",
      keywords: cue.split(/\s*→\s*/).filter(Boolean),
    });
  }

  return result;
}

function parseQnaFile(markdown: string) {
  const category =
    markdown
      .match(/^#\s+(.+)$/m)?.[1]
      ?.replace(/\s*·\s*한영 Q&A\s*$/, "")
      .trim() ?? "면접 Q&A";

  const sections = markdown.split(/\n---\n/g);
  const questions: Omit<InterviewQuestion, "keywords" | "englishKeywords" | "core">[] = [];

  for (const section of sections) {
    const heading = section.match(/^##\s+Q(\d+)\.\s+(.+)$/m);
    if (!heading) continue;
    const number = Number(heading[1]);
    const question = heading[2].trim();
    const summary =
      section.match(/\*\*한 줄 요약:\*\*\s*(.+)/)?.[1]?.trim() ?? "";
    const answer =
      section.match(/\*\*스크립트\*\*\s*\n+([\s\S]*?)(?=\n### English Q&A)/)?.[1] ?? "";
    const englishQuestion =
      section.match(/### English Q&A[\s\S]*?\*\*Q\d+\.\s*(.+?)\*\*/)?.[1] ?? "";
    const englishKeyPoint =
      section.match(/\*\*Key point:\*\*\s*(.+)/)?.[1]?.trim() ?? "";
    const englishAnswer =
      section.match(/\*\*Answer\*\*\s*\n+([\s\S]*?)$/)?.[1] ?? "";

    questions.push({
      id: `q${number}`,
      number,
      category,
      question,
      englishQuestion: stripMarkdown(englishQuestion),
      summary: stripMarkdown(summary),
      answer: stripMarkdown(answer),
      englishKeyPoint: stripMarkdown(englishKeyPoint),
      englishAnswer: stripMarkdown(englishAnswer),
    });
  }

  return questions;
}

function parseResearchPresentation(markdown: string) {
  const stages: ResearchStage[] = [];
  const pattern =
    /^##\s+(.+?)\n+\n\*\*한국어\*\*\n+\n([\s\S]*?)\n+\n\*\*English\*\*\n+\n([\s\S]*?)(?=\n+---|\n+##\s+|$)/gm;

  for (const match of markdown.matchAll(pattern)) {
    const rawTitle = match[1].trim();
    const timed = rawTitle.match(/^(\d+:\d+~\d+:\d+)\s*·\s*(.+)$/);
    const title = timed ? timed[2] : rawTitle;
    const korean = stripMarkdown(match[2]);
    const english = stripMarkdown(match[3]);
    const keywordOverride = researchKeywordOverrides[title];
    stages.push({
      id: `research-${stages.length + 1}`,
      title,
      time: timed?.[1] ?? null,
      korean,
      english,
      keywords: keywordOverride?.korean ?? deriveKeywords(korean),
      englishKeywords: keywordOverride?.english ?? deriveEnglishKeywords(english),
    });
  }

  return stages;
}

function cloneQuestionForCluster(
  question: InterviewQuestion,
  category: ApplicationCluster,
  options: Pick<InterviewQuestion, "sources" | "priority" | "readiness">
): InterviewQuestion {
  return {
    ...question,
    id: `application-${question.id}`,
    category,
    core: options.priority === "S",
    ...options,
  };
}

function supplementalQuestion({
  number,
  category,
  question,
  englishQuestion,
  summary,
  keywords,
  englishKeywords,
  answer,
  englishAnswer = "",
  englishKeyPoint = "",
  priority = "A",
  readiness = "recover",
  sources = ["APPLICATION"],
}: {
  number: number;
  category: ApplicationCluster;
  question: string;
  englishQuestion: string;
  summary: string;
  keywords: string[];
  englishKeywords: string[];
  answer: string;
  englishAnswer?: string;
  englishKeyPoint?: string;
  priority?: "S" | "A" | "B";
  readiness?: "ready" | "partial" | "recover";
  sources?: InterviewQuestion["sources"];
}): InterviewQuestion {
  return {
    id: `application-extra-${number}`,
    number,
    category,
    question,
    englishQuestion,
    summary,
    keywords,
    englishKeywords,
    answer,
    englishKeyPoint,
    englishAnswer,
    core: priority === "S",
    sources,
    priority,
    readiness,
  };
}

const supplementalApplicationQuestions: InterviewQuestion[] = [
  supplementalQuestion({
    number: 101,
    category: "3. My Weapon",
    question: "자기소개서 제목의 ‘나만의 무기’는 한 문장으로 무엇입니까?",
    englishQuestion: "What exactly is the 'unique weapon' described in your statement?",
    summary: "시장·고객·운영의 문제를 데이터와 기술의 구조로 번역하고, 직접 작동하는 서비스까지 구현하는 힘.",
    keywords: ["문제 정의", "데이터 구조화", "현장 운영", "직접 구현", "검증"],
    englishKeywords: ["problem framing", "data structuring", "field operations", "implementation", "validation"],
    answer:
      "제 나만의 무기는 시장·고객·운영의 문제를 데이터와 기술의 구조로 번역하고, 직접 작동하는 서비스까지 구현하는 힘입니다. GfK에서는 시장 질문을 데이터로 구조화했고, 우수살롱에서는 고객 요구를 운영기준으로 바꿨습니다. 최근 AskOosu에서는 제 경험과 프로젝트 정보를 RAG가 검색할 수 있는 지식구조로 만들고 출처와 fallback이 있는 서비스로 구현했습니다. 그래서 제 강점은 기획이나 개발 하나보다 문제정의와 구현 사이의 거리를 줄이는 능력이라고 생각합니다.",
    englishAnswer:
      "My unique strength is translating market, customer, and operational problems into data and technical structures, and then turning them into working services. At GfK, I structured market questions through data. At Oosu Salon, I turned customer needs into operating standards. More recently, in AskOosu, I structured my project information for RAG retrieval and implemented source links and fallback behavior. My strength is therefore reducing the distance between problem definition and implementation rather than specializing in planning or coding alone.",
    englishKeyPoint: "Translate business problems into data and technology, then implement and test them.",
    priority: "S",
    readiness: "ready",
  }),
  supplementalQuestion({
    number: 102,
    category: "2. Career Journey",
    question: "JW CRONY에서 삼성전자 해외 Galaxy Studio 설치·운영 프로젝트를 구체적으로 설명해보세요.",
    englishQuestion: "Please explain your Samsung Galaxy Studio project at JW CRONY.",
    summary: "도쿄 하라주쿠와 상하이 엑스포에서 CGV 4DX 모션체어를 활용한 Galaxy VR 체험관의 기획·설치·운영에 참여.",
    keywords: ["도쿄 하라주쿠", "상하이 엑스포", "Galaxy VR", "CGV 4DX 모션체어", "기획·설치·운영"],
    englishKeywords: ["Harajuku Tokyo", "Shanghai Expo", "Galaxy VR", "CGV 4DX motion chair", "planning · installation · operation"],
    answer:
      "JW CRONY에서는 삼성전자의 해외 Galaxy VR 체험관 프로젝트에 참여했습니다. 제가 직접 기억하는 현장은 도쿄 하라주쿠와 상하이 엑스포이고, CGV 4DX가 제작한 모션체어를 활용해 VR 체험 공간을 기획하고 설치한 뒤 운영하는 업무를 했습니다. 장비 운송이 필요할 때는 CGV 4DX 공장과 소통했고 배송은 그쪽에서 진행했습니다. 제 역할은 기술을 개발하는 것보다 여러 파트너와 현장 실행을 연결해 체험관이 실제로 설치되고 운영되게 만드는 쪽이었습니다.",
    englishAnswer:
      "At JW CRONY, I participated in Samsung's overseas Galaxy VR experience-space projects. The locations I clearly remember working on were Harajuku in Tokyo and the Shanghai Expo. We used motion chairs produced by CGV 4DX to plan, install, and operate VR experience spaces. When equipment had to be transported, I coordinated with the CGV 4DX factory and they handled the shipment. My role was not to develop the technology itself, but to connect partners and on-site execution so that the experience space could actually be installed and operated.",
    englishKeyPoint: "Planning, installation, and operation of Galaxy VR experience spaces in Tokyo and Shanghai using CGV 4DX motion chairs.",
    priority: "S",
    readiness: "ready",
  }),
  supplementalQuestion({
    number: 103,
    category: "2. Career Journey",
    question: "GfK·JW CRONY·태영테크처럼 일부 경력이 짧은 이유는 무엇입니까?",
    englishQuestion: "Why were several of your earlier roles relatively short?",
    summary: "GfK에서 데이터의 중립성에 대한 문제의식을 얻고 실행 역할을 찾아 JW로 이동했으며, JW의 불안정성을 겪은 뒤 직접 리스크를 지는 창업을 선택한 흐름.",
    keywords: ["데이터의 중립성", "조직 이해관계", "JW 이동", "급여 지연", "창업 선택"],
    englishKeywords: ["data neutrality", "organizational interests", "move to JW", "delayed salary", "entrepreneurship"],
    answer:
      "기간이 짧았던 이유는 각 단계마다 분명한 전환 계기가 있었기 때문입니다. GfK에서는 회사 사정도 좋지 않았고, 담당 고객의 요구에 따라 시장 정의나 데이터 가공 방식이 달라지는 일을 반복해서 보면서 데이터가 항상 중립적인 사실로만 쓰이는 것은 아니라는 점을 크게 느꼈습니다. 그래서 좀 더 실행에 가까운 일을 경험하고 싶어 JW CRONY로 옮겼습니다. 그런데 JW에서는 급여가 몇 달 밀릴 정도로 회사의 안정성이 낮았습니다. 회사원으로서도 큰 불확실성을 감수해야 한다면 차라리 그 리스크를 직접 지고 제 사업을 해보자는 생각으로 이어졌고, 이후 우수살롱 창업을 선택했습니다. 태영테크는 그 이후 제한된 기간의 실무 지원 성격이었습니다.",
    englishAnswer:
      "Each short role had a specific reason for transition. At GfK, the company was also going through a difficult period, and I repeatedly saw that market definitions or data framing could change depending on what a client wanted to demonstrate. That experience challenged my earlier belief that data is automatically neutral and made me want to work closer to execution. I therefore moved to JW CRONY. At JW, however, salaries were delayed for several months, so I did not experience the stability I had expected from employment. I began to think that if I had to accept that level of uncertainty anyway, I would rather take the risk directly and build my own business. That thinking led to Oosu Salon. Taeyoung Tech later had a more limited, short-term support nature.",
    englishKeyPoint: "Data framing at GfK changed my view of neutrality; instability at JW then pushed me toward entrepreneurship.",
    priority: "S",
    readiness: "ready",
  }),
  supplementalQuestion({
    number: 104,
    category: "2. Career Journey",
    question: "태영테크에서 수주·매출 데이터를 어떤 방식으로 정리하고 자동화했습니까?",
    englishQuestion: "How did you organize and automate order and sales data at Taeyoung Tech?",
    summary: "지원서에 기재한 범위에서 수주·매출 사무 데이터를 Excel과 Google Sheets로 정리하고, 취합·공유 흐름을 단순화한 경험을 설명.",
    keywords: ["수주·매출 데이터", "Excel", "Google Sheets", "자료 정리", "업무 흐름 개선"],
    englishKeywords: ["order and sales data", "Excel", "Google Sheets", "data organization", "workflow improvement"],
    answer:
      "2022년 초 태영테크에서 운영 데이터 분석가로 짧게 근무하면서 수주·매출 관련 사무 데이터를 정리하고 업무 흐름을 개선하는 일을 맡았습니다. 지원서에 기재한 범위에서 말씀드리면, Excel과 Google Sheets를 이용해 흩어진 자료를 정리하고 취합·공유가 더 수월하도록 기본 구조를 만드는 역할이었습니다. 제가 회사의 전략이나 시스템 구축을 총괄한 것은 아니고, 기존 데이터를 실무자가 확인하고 활용하기 쉬운 형태로 정리하는 실무 지원에 가까웠습니다. 이 경험을 통해 작은 데이터 정리와 자동화도 현장의 업무방식을 바꿀 수 있다는 점을 배웠습니다.",
    englishAnswer:
      "In early 2022, I worked briefly at Taeyoung Tech as an operations data analyst, organizing order and sales-related office data and improving the workflow around it. Within the scope of what I stated in my application, I used Excel and Google Sheets to organize scattered data and make consolidation and sharing easier. I did not lead the company's strategy or a large system implementation; my role was practical support that made existing data easier for staff to review and use. The experience showed me that even small improvements in data organization and automation can change day-to-day operations.",
    englishKeyPoint: "Describe only the submitted, supportable scope: organizing operational data and simplifying consolidation and sharing.",
    priority: "A",
    readiness: "ready",
  }),
  supplementalQuestion({
    number: 105,
    category: "2. Career Journey",
    question: "Sticks & Stones를 지원서의 대표경력으로 체크한 이유는 무엇입니까?",
    englishQuestion: "Why did you mark Sticks & Stones as your representative work experience?",
    summary: "가장 최근의 기술·제품 경험이며 경영 경험과 개발 역량이 현재 연구관심으로 수렴한 경력이라는 점을 설명.",
    keywords: ["가장 최근 경력", "제품 기획", "정보구조", "웹 구현", "연구관심 수렴"],
    englishKeywords: ["most recent role", "product planning", "information architecture", "implementation", "research convergence"],
    answer:
      "지원서의 경력 흐름에서 Sticks & Stones는 시장분석과 사업 운영 이후 기술·제품 구현 역량이 실제 업무로 연결된 가장 최근 경력입니다. 직함을 강조하기보다 정보구조와 웹서비스 개선에서 실제 수행한 역할을 중심으로 설명합니다.",
    priority: "A",
    readiness: "ready",
  }),
  supplementalQuestion({
    number: 106,
    category: "4. Undergraduate & Activities",
    question: "MiFE에서는 매주 실제로 무엇을 했고 본인은 어떤 역할을 했습니까?",
    englishQuestion: "What did you actually do each week in MiFE, and what was your role?",
    summary: "2012.03~2014.02 MiFE Staff로 매주 브랜드·마케팅 사례연구와 토론 미팅 운영, 기업연계 프로그램 참여.",
    keywords: ["2012~2014", "Staff", "주간 사례연구", "토론 미팅", "기업연계"],
    englishKeywords: ["2012–2014", "staff member", "weekly case studies", "discussion meetings", "industry-linked program"],
    answer:
      "MiFE에서는 2012년 3월부터 2014년 2월까지 스태프로 활동했습니다. 매주 브랜드와 마케팅 사례를 선정해 구성원들과 분석하고 토론하는 미팅을 운영했고, 기업과 연계된 산학협력 프로그램에도 참여했습니다. 제 역할은 단순히 참석하는 것보다 정기적인 사례연구와 토론이 계속 돌아가도록 운영하는 쪽에 가까웠습니다.",
    englishAnswer:
      "I was a staff member of MiFE from March 2012 to February 2014. We held weekly meetings in which we selected brand and marketing cases, analyzed them, and discussed them together. I also participated in university–industry programs. My role was closer to helping operate the recurring case-study and discussion process than simply attending meetings.",
    englishKeyPoint: "Two years as MiFE staff, operating weekly case-study discussions and participating in industry-linked programs.",
    priority: "S",
    readiness: "ready",
    sources: ["APPLICATION", "ALUMNI"],
  }),
  supplementalQuestion({
    number: 107,
    category: "4. Undergraduate & Activities",
    question: "LG전자 스타일러 IMC 전략의 핵심 아이디어와 본인의 기여는 무엇이었습니까?",
    englishQuestion: "What was the core idea of your LG Styler IMC strategy and your contribution?",
    summary: "출시 초기 낮은 인지와 판매 문제를 새로운 제품군의 정체성 문제로 보고, 세탁기가 아닌 의류관리제품인 ‘의류냉장고’ 포지셔닝을 제안.",
    keywords: ["출시 초기", "제품군 인지 부족", "의류관리제품", "의류냉장고", "최우수상"],
    englishKeywords: ["early launch", "category awareness", "clothing-care product", "clothing refrigerator", "top award"],
    answer:
      "당시는 스타일러가 출시된 지 얼마 되지 않아 판매가 기대만큼 나오지 않던 시기였고, 새로운 제품군이라 소비자가 제품을 무엇으로 이해해야 하는지가 명확하지 않다고 봤습니다. 그래서 세탁기의 연장선이 아니라 별도의 의류관리제품으로 인식시키자는 방향을 잡고, 이를 직관적으로 전달하기 위해 ‘의류냉장고’라는 포지셔닝을 제안했습니다. 팀 프로젝트로 이 전략을 제안해 최우수상을 받았습니다. 다만 당시 팀 내 세부 역할분담과 제가 단독으로 맡은 산출물은 더 확인해서 정확히 구분해 말씀드리겠습니다.",
    priority: "S",
    readiness: "partial",
    sources: ["APPLICATION", "ALUMNI"],
  }),
  supplementalQuestion({
    number: 108,
    category: "4. Undergraduate & Activities",
    question: "랑세스-한국경제 영어 프레젠테이션 챌린지에서는 무엇을 발표했습니까?",
    englishQuestion: "What did you present in the LANXESS-Hankyung English Presentation Challenge?",
    summary: "지원서 수상경력. 주제·본인 역할·본선 결과를 복원해야 함.",
    keywords: ["발표 주제", "영어 발표", "준비 과정", "본선", "배운 점"],
    englishKeywords: ["presentation topic", "English presentation", "preparation", "final round", "learning"],
    answer: "사실 복원 필요. 제출한 수상경력이므로 당시 발표 주제와 본인의 준비 과정, 본선에서 무엇을 보여줬는지를 확인해야 합니다.",
    priority: "A",
  }),
  supplementalQuestion({
    number: 109,
    category: "4. Undergraduate & Activities",
    question: "SK Better World 아이디어 공모전에서는 어떤 아이디어로 우수상을 받았습니까?",
    englishQuestion: "What idea won an excellence award in the SK Better World competition?",
    summary: "지원서 수상경력. 아이디어·문제정의·본인 역할·평가 포인트를 복원해야 함.",
    keywords: ["문제정의", "아이디어", "본인 역할", "우수상", "평가 포인트"],
    englishKeywords: ["problem", "idea", "role", "award", "evaluation point"],
    answer: "사실 복원 필요. 아이디어의 대상 문제, 제안 내용, 본인 기여, 왜 좋은 평가를 받았다고 생각하는지 네 요소를 당시 자료에서 확인합니다.",
    priority: "A",
  }),
  supplementalQuestion({
    number: 110,
    category: "4. Undergraduate & Activities",
    question: "한국관광공사 한울 프로젝트는 무엇이었고 본인의 역할은 무엇입니까?",
    englishQuestion: "What was the Korea Tourism Organization Hanul project and what was your role?",
    summary: "지원서 수상경력. 프로젝트 목적·본인 역할·우수기획서상 근거를 복원해야 함.",
    keywords: ["프로젝트 목적", "관광공사", "본인 역할", "기획서", "결과"],
    englishKeywords: ["project purpose", "KTO", "role", "proposal", "result"],
    answer: "사실 복원 필요. 지원서의 공식 수상 항목이므로 프로젝트 목적, 본인이 맡은 부분, 결과물과 수상 이유를 확인합니다.",
    priority: "A",
  }),
  supplementalQuestion({
    number: 111,
    category: "4. Undergraduate & Activities",
    question: "농민의 날 프로젝트에서 어떤 기획으로 우수기획서상을 받았습니까?",
    englishQuestion: "What proposal earned an award in the Farmers' Day project?",
    summary: "지원서 수상경력. 문제·기획안·본인 역할·수상 이유를 복원해야 함.",
    keywords: ["농민의 날", "문제", "기획안", "본인 역할", "수상 이유"],
    englishKeywords: ["Farmers' Day", "problem", "proposal", "role", "award rationale"],
    answer: "사실 복원 필요. 당시 프로젝트의 과제와 본인의 역할, 기획서의 핵심 아이디어를 확인한 뒤 답변합니다.",
    priority: "A",
  }),
  supplementalQuestion({
    number: 112,
    category: "4. Undergraduate & Activities",
    question: "경영학과 12학번 부대표로 실제 어떤 일을 했습니까?",
    englishQuestion: "What did you actually do as the 2012 business-school class vice representative?",
    summary: "축제·MT 기획이라는 제출 문장을 역할·문제·행동·결과의 한 사례로 구체화.",
    keywords: ["부대표", "축제·MT", "책임 범위", "문제 해결", "결과"],
    englishKeywords: ["vice representative", "festival and MT", "responsibility", "problem solving", "result"],
    answer:
      "부분 준비. 축제와 MT를 기획·운영했다는 사실과 이후 리더십 해석은 준비되어 있습니다. 다만 면접용으로는 실제 한 상황을 골라 본인의 책임과 행동을 구체화해야 합니다.",
    priority: "A",
    readiness: "partial",
  }),
  supplementalQuestion({
    number: 113,
    category: "4. Undergraduate & Activities",
    question: "한국대학생인재협회와 스펙업 프로젝트에서는 각각 무엇을 직접 기획·조율했습니까?",
    englishQuestion: "What did you directly plan and coordinate in the student association and Specup project?",
    summary: "한국대학생인재협회 임원으로 프로젝트 목표와 실행을 조율하고, Specup에서는 대규모 1일 취업행사의 PM으로 여러 TF를 연결.",
    keywords: ["인재협회 임원", "프로젝트 조율", "Specup PM", "1일 취업행사", "TF 연결"],
    englishKeywords: ["association executive", "project coordination", "Specup PM", "one-day employment event", "cross-team coordination"],
    answer:
      "한국대학생인재협회에서는 임원으로 프로젝트의 목표와 실행 방향을 조율했고, 농민의 날 캠페인에서는 500명 이상의 오프라인 참여를 연결하고 온라인 확산을 관리했습니다. 스펙업에서는 약 1,300명이 참여하는 1일 취업행사의 PM으로 행사기획, 대외협력, 디자인, 홍보 TF가 같은 목표와 일정으로 움직이도록 조율했습니다. 이 경험을 통해 리더십은 모든 일을 직접 하는 것이 아니라 여러 역할을 하나의 결과로 연결하는 일이라는 점을 배웠습니다.",
    englishAnswer:
      "In the Korean university student talent association, I worked as an executive coordinating project goals and execution. In a Farmers' Day campaign, I helped coordinate more than 500 offline participants and managed online promotion. At Specup, I was project manager for a one-day employment event attended by about 1,300 people, aligning the event-planning, external-relations, design, and promotion teams around the same goals and deadlines. These experiences taught me that leadership is not doing everything myself, but connecting different roles to one result.",
    englishKeyPoint: "Coordinate goals, deadlines, and multiple teams rather than trying to do everything personally.",
    priority: "A",
    readiness: "ready",
  }),
  supplementalQuestion({
    number: 114,
    category: "5. Academic Record & Weakness",
    question: "고등학교 졸업 검정고시를 보게 된 배경을 설명해보세요.",
    englishQuestion: "Why did you complete high school through the qualification exam?",
    summary: "대치동 이사 후 학교 적응에 어려움을 겪어 자퇴·검정고시를 선택했고, 이후 재수학원에서 다시 입시를 준비해 대학 진학.",
    keywords: ["대치동 이사", "학교 적응", "자퇴", "검정고시", "재수학원·대학 진학"],
    englishKeywords: ["move to Daechi-dong", "school adjustment", "leave school", "qualification exam", "college preparation"],
    answer:
      "대치동으로 이사한 뒤 학교생활에 제대로 적응하지 못했고, 결국 학교를 그만두고 검정고시를 선택했습니다. 이후에는 재수학원을 다니며 대학입시를 다시 준비했고 대학에 진학했습니다. 특별한 성취로 포장하기보다는 당시 학교 환경에 적응하지 못해 다른 경로를 선택했고, 이후 다시 학업을 이어간 경험으로 말씀드리고 싶습니다.",
    englishAnswer:
      "After my family moved to Daechi-dong, I had difficulty adjusting to school life, and I eventually left school and completed the high-school qualification exam instead. After that, I attended a college-preparation academy, prepared again for university admission, and later entered university. I do not present it as a special achievement; it was simply a different route I took after struggling to adjust to that school environment, and I later returned to formal study.",
    englishKeyPoint: "Difficulty adjusting after a move led to the qualification-exam route, followed by renewed preparation for university.",
    priority: "A",
    readiness: "ready",
  }),
  supplementalQuestion({
    number: 115,
    category: "5. Academic Record & Weakness",
    question: "2012년 입학 후 2018년 졸업까지 재학기간이 긴 이유는 무엇입니까?",
    englishQuestion: "Why did your undergraduate study span from 2012 to 2018?",
    summary: "입대 전 한 학기 휴학, KATUSA 복무, 졸업학점 이수 후 졸업유예 상태로 구직하다가 2018년 졸업신청.",
    keywords: ["입대 전 1학기 휴학", "학생회 마무리", "KATUSA", "졸업유예", "구직 후 졸업신청"],
    englishKeywords: ["one-semester leave", "finish student activities", "KATUSA", "deferred graduation", "job search"],
    answer:
      "2012년에 입학한 뒤 KATUSA에 합격했고, 입대 전에 한 학기를 휴학했습니다. 당시 학생회 활동에 과도하게 몰입해 있었기 때문에 맡은 활동을 마무리한 뒤 입대했고, 2014년부터 2015년까지 복무했습니다. 이후 복학해 필요한 이수학점을 모두 채웠지만 바로 졸업하지 않고 졸업유예 상태로 구직활동을 했고, 이후 졸업신청을 해 2018년 8월 졸업했습니다. 재학기간 자체는 이 학적 흐름으로 설명하고, 학점 관리의 부족은 별개의 문제로 인정하고 있습니다.",
    englishAnswer:
      "I entered university in 2012 and, after being accepted into KATUSA, took one semester of leave before enlistment. At the time I was heavily involved in student activities, so I finished those responsibilities before entering the military and served from 2014 to 2015. After returning, I completed the credits required for graduation but deferred graduation while looking for work. I later applied to graduate and completed the degree in August 2018. I explain the length of enrollment through this academic timeline, while treating my GPA management as a separate issue for which I take responsibility.",
    englishKeyPoint: "Pre-service leave, KATUSA service, then deferred graduation after completing credits while job hunting.",
    priority: "S",
    readiness: "ready",
  }),
  supplementalQuestion({
    number: 116,
    category: "5. Academic Record & Weakness",
    question: "광고PR브랜딩 부전공을 선택한 이유와 지금 연구와의 연결은 무엇입니까?",
    englishQuestion: "Why did you minor in advertising, PR and branding, and how does it connect to your research now?",
    summary: "당시 세무·회계보다 마케팅과 조직관리 분야에 관심이 컸고, 광고PR브랜딩이 그 관심과 잘 맞는다고 판단해 선택.",
    keywords: ["마케팅 관심", "조직관리", "세무·회계보다 선호", "광고PR브랜딩", "현재 관심의 확장"],
    englishKeywords: ["marketing interest", "organization management", "less interest in accounting", "advertising PR branding", "later extension"],
    answer:
      "학부 당시에는 세무나 회계 쪽보다 마케팅과 조직관리 분야에 더 관심이 많았습니다. 그래서 소비자와 시장을 더 구체적으로 다룰 수 있는 광고PR브랜딩 부전공이 제 관심과 잘 맞는다고 생각해 선택했습니다. 당시부터 지금의 AI 연구를 염두에 둔 것은 아니지만, 이후 MiFE와 스타일러 프로젝트, 사업 운영을 거치면서 사용자 인식과 기술수용에 대한 관심이 계속 발전했고 현재의 연구질문으로 이어졌습니다.",
    englishAnswer:
      "As an undergraduate, I was more interested in marketing and organization management than in tax or accounting. I therefore chose the advertising, PR, and branding minor because it seemed to fit those interests and allowed me to study consumers and markets more directly. I was not thinking about AI research at the time. The connection is retrospective: through MiFE, the Styler project, and later business operations, my interest in user perception and technology adoption gradually developed into my current research question.",
    englishKeyPoint: "The original reason was a stronger interest in marketing and organizations; the AI connection developed later.",
    priority: "A",
    readiness: "ready",
  }),
  supplementalQuestion({
    number: 117,
    category: "5. Academic Record & Weakness",
    question: "공식 제출 TOEIC은 925인데 특기란에는 과거 TOEIC 990과 OPIc AL을 적었습니다. 현재 영어역량을 어떻게 설명하겠습니까?",
    englishQuestion: "Your submitted TOEIC is 925, while you mention a previous 990 and OPIc AL. How would you describe your current English ability?",
    summary: "공식 점수와 과거 최고점수를 구분하고 영어 수업·논문 읽기·즉답 역량을 과장 없이 설명.",
    keywords: ["공식 925", "과거 990", "OPIc AL", "영어 연구", "구분"],
    englishKeywords: ["official 925", "previous 990", "OPIc AL", "academic English", "distinction"],
    answer:
      "공식 제출점수는 2025년 TOEIC 925이고, TOEIC 990과 OPIc AL은 과거 성취로 구분합니다. 영어 논문 읽기와 수업 참여에는 강점이 있지만 면접에서는 현재 즉답 능력을 실제 영어 답변으로 보여주는 것이 가장 정확합니다.",
    priority: "A",
    readiness: "ready",
  }),
  supplementalQuestion({
    number: 118,
    category: "6. Projects & Technical Credibility",
    question: "왜 오프라인 사업의 확장성 한계를 느낀 뒤 개발을 배우는 것이 해답이라고 판단했습니까?",
    englishQuestion: "Why did the scalability limits of an offline business lead you to learn development?",
    summary: "사업 운영의 반복·확장 한계 → 디지털 제품을 직접 만들고 실험할 필요 → 기획과 구현 사이 거리 축소.",
    keywords: ["오프라인 한계", "확장성", "디지털 제품", "직접 실험", "기획-구현"],
    englishKeywords: ["offline limits", "scalability", "digital products", "experimentation", "planning-to-implementation"],
    answer:
      "우수살롱을 운영하며 입지·인력·시간에 묶이는 오프라인 비즈니스의 제약을 경험했고, 더 넓은 시장에서 아이디어를 반복 실험하려면 디지털 제품을 이해하고 직접 만들 수 있어야 한다고 판단했습니다. 그래서 Flutter, UX/UI, 생성형 AI 과정으로 구현 역량을 단계적으로 보완했습니다.",
    priority: "S",
    readiness: "ready",
  }),
  supplementalQuestion({
    number: 119,
    category: "6. Projects & Technical Credibility",
    question: "세 번의 부트캠프에서 각각 무엇을 배웠고 어떤 실제 산출물로 이어졌습니까?",
    englishQuestion: "What did each of your three bootcamps add, and what outputs resulted from them?",
    summary: "Flutter=제품 구현, UX/UI=정보구조·사용자흐름, GenAI=Python·backend·RAG → 실제 프로젝트로 연결.",
    keywords: ["Flutter", "UX/UI", "생성형 AI", "각 단계 역할", "실제 산출물"],
    englishKeywords: ["Flutter", "UX/UI", "generative AI", "distinct layer", "actual output"],
    answer:
      "각 과정은 같은 목표를 다른 층위에서 보완했습니다. Flutter 과정에서는 아이디어를 작동하는 제품으로 만드는 구조를, UX/UI 과정에서는 정보구조와 사용자 흐름을, 생성형 AI 과정에서는 Python·백엔드·RAG 기반 지식서비스 구현을 배웠습니다. 각 단계는 이후 웹·AI 프로젝트 산출물로 연결했습니다.",
    priority: "A",
    readiness: "ready",
  }),
  supplementalQuestion({
    number: 120,
    category: "6. Projects & Technical Credibility",
    question: "소상공인이 디지털 도구를 쉽게 신뢰하지 못한다고 지원서에 썼는데 실제 사례가 있습니까?",
    englishQuestion: "You wrote that small-business owners may distrust digital tools. What concrete example did you observe?",
    summary: "우수살롱 오픈 직후 쏟아진 저품질 온라인 마케팅 제휴와 사후관리 실패, 세무사 교체 경험을 통해 외부 서비스의 품질을 사전에 검증하기 어렵다는 문제를 경험.",
    keywords: ["온라인 마케팅 제휴", "다채널 영업", "낮은 품질", "사후관리 실패", "추천 기반 신뢰"],
    englishKeywords: ["digital marketing offers", "multi-channel solicitation", "low quality", "poor follow-up", "trust through referrals"],
    answer:
      "우수살롱을 처음 열었을 때 블로그 체험단과 온라인 마케팅 제휴 제안이 네이버 메시지, 문자, 전화, 인스타그램 DM 등 거의 모든 채널로 쏟아졌습니다. 문제는 영업 설명은 그럴듯해도 실제 서비스 품질이 낮거나 사후관리가 되지 않는 경우가 많아, 외부 서비스를 처음부터 신뢰하기가 어려워졌다는 점입니다. 세무 서비스도 비슷해서 세무사를 두 번 바꾼 뒤에야 주변 사장님의 추천을 받은 곳에 정착했습니다. 이 경험을 통해 소상공인에게는 기능의 존재보다 공급자의 주장과 실제 품질을 검증할 수 있는 근거와 신뢰경로가 중요하다고 느꼈습니다.",
    englishAnswer:
      "When I first opened Oosu Salon, I received a flood of offers for blog-review campaigns and digital marketing partnerships through Naver messages, text messages, phone calls, and Instagram DMs. The problem was that the sales pitch could sound convincing while the actual service quality or follow-up was often poor, so I became cautious about trusting outside services from the beginning. I had a similar experience with tax services: I changed accountants twice before settling on one recommended by another business owner. This taught me that for small businesses, trust often depends less on the existence of features and more on having credible evidence and a reliable way to verify the provider's actual quality.",
    englishKeyPoint: "Repeated low-quality marketing and professional-service experiences made verification and trusted referrals more important than sales claims.",
    priority: "S",
    readiness: "ready",
  }),
  supplementalQuestion({
    number: 121,
    category: "7. Person & Research Life",
    question: "연구에서 막히면 어떤 순서로 해결하겠습니까?",
    englishQuestion: "What would you do when you get stuck in your research?",
    summary: "먼저 문제를 재현·검색하고 스스로 시도 → 동료·선배에게 구체적 질문 → 연구방향 문제는 정리해서 교수에게 질문.",
    keywords: ["문제 재현", "독립적 탐색", "동료·선배", "교수", "정리된 질문"],
    englishKeywords: ["reproduce problem", "independent search", "peers", "advisor", "structured question"],
    answer:
      "먼저 문제를 재현하고 제가 아는 범위와 시도한 방법을 정리한 뒤 문헌·검색·코드나 데이터를 통해 독립적으로 해결해보겠습니다. 일정 시간 이상 막히면 동료나 선배에게 구체적인 힌트를 구하고, 연구방향 자체의 판단이 필요하면 시도한 내용과 쟁점을 정리해 교수님께 질문하겠습니다.",
    priority: "A",
    readiness: "ready",
    sources: ["ALUMNI", "FOLLOW-UP"],
  }),
  supplementalQuestion({
    number: 122,
    category: "7. Person & Research Life",
    question: "Sticks & Stones 대표인 추천인은 지원자를 어떤 사람이라고 평가할 것 같습니까?",
    englishQuestion: "How do you think your recommender, the CEO of Sticks & Stones, would describe you?",
    summary: "기술해법부터 밀어붙이기보다 사업·고객·브랜드·운영비용을 먼저 이해하고, 필요한 기술을 스스로 학습해 끝까지 구현하는 사람.",
    keywords: ["사업목표 우선", "고객 이해", "정보구조", "빠른 학습", "TypeScript 전환"],
    englishKeywords: ["business goals first", "customer understanding", "information architecture", "fast learning", "TypeScript migration"],
    answer:
      "함께 일한 과정을 기준으로 보면 대표님은 저를 기술 자체보다 사업목표와 사용자를 먼저 보는 사람이라고 평가하실 것 같습니다. 사이트 개편에서도 바로 프레임워크부터 정하기보다 고객이 어떤 정보를 찾는지와 브랜드가 무엇을 전달해야 하는지부터 정리했습니다. 이후 문서화가 부족한 기존 WordPress 구조를 직접 조사하고 필요한 기술을 학습해 TypeScript 기반 환경으로 전환했습니다. 새로운 영역을 스스로 공부하되 기술결정을 브랜드, 고객 커뮤니케이션, 유지보수 비용과 운영 효율까지 함께 보고 내린다는 점을 직접 보셨습니다.",
    englishAnswer:
      "Based on how we worked together, I think my recommender would describe me as someone who looks at business goals and users before the technology itself. During the website redesign, I did not start by choosing a framework; I first clarified what customers needed to find and what the brand needed to communicate. I then investigated the poorly documented WordPress structure, learned the necessary technology, and helped move the site to a TypeScript-based environment. He directly observed that I learn unfamiliar areas independently while considering brand communication, maintenance cost, and operational efficiency together with the technical decision.",
    englishKeyPoint: "Business-first judgment, user-centered information structure, and self-directed technical learning through implementation.",
    priority: "B",
    readiness: "ready",
  }),
];

function buildResearchDefenseQuestions(questions: InterviewQuestion[]) {
  const selected = new Set([
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
    31, 38, 70, 71, 72, 73, 74,
  ]);
  const sPriority = new Set([11, 12, 13, 14, 15, 17, 23, 25, 26, 28, 29]);
  const bPriority = new Set([70, 71, 72, 73, 74]);

  return questions
    .filter((question) => selected.has(question.number))
    .map((question) => ({
      ...question,
      id: `defense-${question.id}`,
      answer: researchDefenseSpokenOverrides[question.number] ?? question.answer,
      sources:
        question.number <= 28
          ? (["OFFICIAL", "FOLLOW-UP"] as InterviewQuestion["sources"])
          : question.number <= 31
            ? (["APPLICATION", "FOLLOW-UP"] as InterviewQuestion["sources"])
            : (["FOLLOW-UP"] as InterviewQuestion["sources"]),
      priority: sPriority.has(question.number)
        ? ("S" as const)
        : bPriority.has(question.number)
          ? ("B" as const)
          : ("A" as const),
      readiness: "ready" as const,
      core: sPriority.has(question.number),
    }));
}

function buildApplicationOpening(questions: InterviewQuestion[]) {
  const thirty = questions.find((question) => question.number === 1);
  const sixty = questions.find((question) => question.number === 2);
  if (!thirty || !sixty) return [];

  const thirtyKorean =
    "안녕하십니까, 지원자 장우수입니다. 오늘 면접이 끝난 뒤 저를 ‘직접 시도해보고 답을 찾는 사람’으로 기억해주시면 좋겠습니다. 저는 비즈니스를 더 깊이 이해하고 싶어 직접 사업을 시작해 약 5년간 운영했고, 기술의 필요성을 느낀 뒤에는 개발을 배워 RAG 기반 AI 서비스까지 만들어봤습니다. 직접 해보는 과정에서 늘 다음 질문이 생겼고, 이제 KAIST BTM에서는 그 질문을 경험이 아니라 연구로 검증해보고 싶습니다.";
  const thirtyEnglish =
    "Hello, I'm Woosu Jang. If you remember one thing about me, I hope it's that I learn by trying things myself. I ran my own business for nearly five years, then learned development and built RAG-based AI services when I saw the need for technology. Each step led to a new question. At KAIST BTM, I want to turn those questions from practical experience into research I can test systematically.";

  const openingCard = (
    source: InterviewQuestion,
    number: number,
    duration: "30초" | "1분"
  ): InterviewQuestion => {
    const isThirty = source.number === 1;
    return {
      ...source,
      id: `application-opening-${duration === "30초" ? "30" : "60"}`,
      number,
      displayNumber: `OPEN ${number}`,
      category: "0. Opening",
      summary: `${duration} 자기소개. 최근 재학생 면접 사례에서는 영어 자기소개가 첫 질문으로 출제되어 English를 우선 연습하되 한국어도 같은 카드에서 전환합니다.`,
      keywords: isThirty
        ? ["직접 시도", "약 5년 사업 운영", "개발 학습", "RAG 서비스", "경험에서 연구로"]
        : source.keywords,
      englishKeywords: isThirty
        ? ["try things myself", "five-year business", "learn development", "RAG services", "experience to research"]
        : source.englishKeywords,
      answer: isThirty ? thirtyKorean : source.answer,
      englishAnswer: isThirty ? thirtyEnglish : source.englishAnswer,
      core: true,
      sources: ["APPLICATION", "ALUMNI"],
      priority: "S",
      readiness: "ready",
    };
  };

  return [
    openingCard(thirty, 1, "30초"),
    openingCard(sixty, 2, "1분"),
  ];
}

function buildApplicationQuestions(questions: InterviewQuestion[]) {
  const clusterMap: Record<ApplicationCluster, number[]> = {
    "0. Opening": [],
    "1. Motivation & BTM Fit": [4, 5, 6, 7, 8, 9, 10, 63, 64],
    "2. Career Journey": [39, 40, 41, 42, 46],
    "3. My Weapon": [47, 61, 62, 77, 78, 79],
    "4. Undergraduate & Activities": [51, 54, 55, 56, 57],
    "5. Academic Record & Weakness": [32, 33, 34, 35, 76],
    "6. Projects & Technical Credibility": [36, 37, 43, 44, 45],
    "7. Person & Research Life": [48, 49, 50, 52, 53, 58, 59, 60, 75],
  };

  const sPriority = new Set([4, 5, 7, 32, 39, 40, 41, 44, 46, 47, 51, 56, 62, 63]);
  const bPriority = new Set([76, 77, 78, 79]);
  const partial = new Set<number>();
  const alumniPattern = new Set([4, 5, 7, 32, 33, 51, 56, 57]);
  const result: InterviewQuestion[] = [];

  for (const category of applicationClusterOrder) {
    if (category === "0. Opening") {
      result.push(...buildApplicationOpening(questions));
      continue;
    }
    for (const number of clusterMap[category]) {
      const question = questions.find((item) => item.number === number);
      if (!question) continue;
      result.push(
        cloneQuestionForCluster(question, category, {
          sources: alumniPattern.has(number)
            ? ["APPLICATION", "ALUMNI"]
            : ["APPLICATION"],
          priority: sPriority.has(number) ? "S" : bPriority.has(number) ? "B" : "A",
          readiness: partial.has(number) ? "partial" : "ready",
        })
      );
    }
    result.push(...supplementalApplicationQuestions.filter((item) => item.category === category));
  }

  return result.map((question) => ({
    ...question,
    answer: applicationSpokenOverrides[question.number] ?? question.answer,
    englishAnswer: question.englishAnswer?.split(/\n\s*###\s/)[0].trim(),
    speakable: !unspeakableApplicationNumbers.has(question.number),
  }));
}

export function loadInterviewContent(): InterviewContent {
  const overridePath = process.env.INTERVIEW_CONTENT_DIR;

  if (!overridePath) {
    try {
      return JSON.parse(
        fs.readFileSync(BUNDLED_CONTENT_PATH, "utf8")
      ) as InterviewContent;
    } catch (error) {
      console.warn("Could not load bundled KAIST interview content:", error);
      return {
        questions: fallbackQuestions,
        coreQuestions: fallbackQuestions,
        researchDefenseQuestions: fallbackQuestions,
        applicationQuestions: fallbackQuestions,
        researchStages: fallbackResearch,
        sourcePath: "bundled fallback",
        loadedFromLocalNotionMirror: false,
      };
    }
  }

  const sourcePath = overridePath;
  const qnaDir = path.join(sourcePath, "02_qna");
  const cuePath = path.join(
    sourcePath,
    "04_active_recall_pack",
    "01_keyword_flashcards.md"
  );
  const researchPath = path.join(
    sourcePath,
    "01_research_presentation",
    "KAIST_BTM_10min_research_presentation_bilingual.md"
  );

  try {
    const qnaFiles = fs
      .readdirSync(qnaDir)
      .filter((name) => /^0[1-8]_.*\.md$/.test(name))
      .sort();
    const baseQuestions = qnaFiles.flatMap((name) =>
      parseQnaFile(fs.readFileSync(path.join(qnaDir, name), "utf8"))
    );
    const coreCues = fs.existsSync(cuePath)
      ? parseCoreCueFile(fs.readFileSync(cuePath, "utf8"))
      : [];

    const explicitCoreTargets = new Map<string, number>([
      [normalizeQuestion("왜 이 연구가 필요합니까?"), 23],
      [normalizeQuestion("왜 신뢰가 아니라 적정 의존(calibrated reliance)입니까?"), 16],
      [normalizeQuestion("연구방법을 설명해보세요."), 17],
      [normalizeQuestion("독립변수와 종속변수는 무엇입니까?"), 18],
      [normalizeQuestion("교수 컨택을 했습니까? 그게 합격 보장이라는 뜻입니까?"), 29],
      [normalizeQuestion("학생회와 대외활동 때문에 학점이 낮았다는 건가요?"), 33],
      [normalizeQuestion("고학점 지원자 대신 왜 본인을 뽑아야 합니까?"), 62],
      [normalizeQuestion("졸업 후 무엇을 하고 싶습니까?"), 58],
    ]);

    const questions: InterviewQuestion[] = baseQuestions.map((question) => {
      let best:
        | { question: string; englishQuestion: string; keywords: string[] }
        | undefined;
      let bestScore = 0;
      for (const cue of coreCues) {
        const score = diceSimilarity(question.question, cue.question);
        if (score > bestScore) {
          best = cue;
          bestScore = score;
        }
      }

      const isCore = bestScore >= 0.52;
      return {
        ...question,
        keywords: isCore && best ? best.keywords : deriveKeywords(question.summary),
        englishKeywords: deriveEnglishKeywords(
          question.englishKeyPoint || question.englishAnswer || question.englishQuestion
        ),
        core: isCore,
      };
    });

    const specialCoreAnswers = new Map<string, string>([
      [
        normalizeQuestion("왜 이 연구가 필요합니까?"),
        "조직에서 중요한 문제는 AI를 많이 쓰게 만드는 것 자체가 아니라, 근거가 약한 답을 과신하지 않으면서 필요한 순간에는 적절히 활용하게 만드는 것입니다. 실제 업무용 RAG에서는 정답률뿐 아니라 사용자가 출처와 최신성, 불확실성을 어떻게 확인하고 검증하는지가 의사결정 품질을 좌우합니다. 그래서 저는 지식구조와 검증 설계가 실제 검증행동과 적정 의존에 어떤 영향을 주는지 연구하고 싶습니다.",
      ],
      [
        normalizeQuestion("학생회와 대외활동 때문에 학점이 낮았다는 건가요?"),
        "아닙니다. 학생회와 대외활동은 당시 시간배분을 설명하는 사실이지만 낮은 학점을 정당화하지는 못합니다. 그 활동을 선택한 것도 저이고 학업을 기본축으로 두지 못한 결과도 제 책임입니다. 다만 이후에는 GfK 데이터 업무, 약 5년의 사업 운영, AI 프로젝트를 끝까지 수행하면서 마감과 산출물 중심으로 일정을 관리하는 방식으로 바꿨고, 대학원 준비도 통계 복습과 논문 재현 결과로 증명하겠습니다.",
      ],
      [
        normalizeQuestion("고학점 지원자 대신 왜 본인을 뽑아야 합니까?"),
        "학점만 놓고 보면 고학점 지원자가 더 검증되어 있다는 점을 인정합니다. 제가 더할 수 있는 가치는 시장데이터 분석, 약 5년의 현장 운영, 정보구조와 RAG 구현 경험을 하나의 조직 AI 연구문제로 연결할 수 있다는 점입니다. 저는 조직 AI의 문제를 추상적으로만 말하는 것이 아니라 실제 과업과 프로토타입으로 바꿀 수 있습니다. 다만 이 경험이 연구성과를 자동으로 보장하지는 않기 때문에 연구방법론과 계량 역량을 우선 보완하고 석사논문으로 증명하겠습니다.",
      ],
    ]);

    const coreQuestions: InterviewQuestion[] = coreCues.map((cue, index) => {
      const normalizedCue = normalizeQuestion(cue.question);
      const explicitNumber = explicitCoreTargets.get(normalizedCue);
      let match = explicitNumber
        ? questions.find((question) => question.number === explicitNumber)
        : undefined;

      if (!match) {
        let bestScore = 0;
        for (const question of questions) {
          const score = diceSimilarity(question.question, cue.question);
          if (score > bestScore) {
            bestScore = score;
            match = question;
          }
        }
      }

      return {
        ...(match ?? fallbackQuestions[0]),
        id: `core-${String(index + 1).padStart(2, "0")}`,
        number: index + 1,
        question: cue.question,
        englishQuestion: cue.englishQuestion || match?.englishQuestion || "",
        keywords: cue.keywords,
        englishKeywords:
          match?.englishKeywords ??
          deriveEnglishKeywords(cue.englishQuestion || match?.englishKeyPoint || ""),
        answer: specialCoreAnswers.get(normalizedCue) ?? match?.answer ?? "",
        core: true,
      };
    });

    const researchStages = parseResearchPresentation(
      fs.readFileSync(researchPath, "utf8")
    ).map((stage) => ({
      ...stage,
      korean: researchPresentationSpokenOverrides[stage.title] ?? stage.korean,
    }));

    return {
      questions: questions.sort((a, b) => a.number - b.number),
      coreQuestions,
      researchDefenseQuestions: buildResearchDefenseQuestions(questions),
      applicationQuestions: buildApplicationQuestions(questions),
      researchStages,
      sourcePath,
      loadedFromLocalNotionMirror: true,
    };
  } catch (error) {
    console.warn("Could not load local KAIST interview notes:", error);
    return {
      questions: fallbackQuestions,
      coreQuestions: fallbackQuestions,
      researchDefenseQuestions: fallbackQuestions,
      applicationQuestions: fallbackQuestions,
      researchStages: fallbackResearch,
      sourcePath,
      loadedFromLocalNotionMirror: false,
    };
  }
}
