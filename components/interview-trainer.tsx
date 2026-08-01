"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  Flame,
  FileText,
  GraduationCap,
  Headphones,
  Languages,
  ListFilter,
  Mic2,
  Network,
  Pause,
  Play,
  Presentation,
  RefreshCw,
  RotateCcw,
  Shuffle,
  Target,
} from "lucide-react";

import type {
  InterviewContent,
  InterviewQuestion,
  ResearchStage,
} from "@/lib/interview-content";

type Rating = "again" | "unsure" | "mastered";
type SavedProgress = Record<string, Rating>;
type Section = "research" | "application";
type Deck = "core" | "all" | "weak";
type Difficulty = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type PracticeLanguage = "ko" | "en";

const difficultyOptions: {
  id: Difficulty;
  label: string;
  description: string;
  maskRatio: number;
}[] = [
  { id: 1, label: "1 · 안내", description: "전부 보기", maskRatio: 0 },
  { id: 2, label: "2 · 워밍업", description: "약 10% 가리기", maskRatio: 0.1 },
  { id: 3, label: "3 · 기초", description: "약 20% 가리기", maskRatio: 0.2 },
  { id: 4, label: "4 · 연습", description: "약 30% 가리기", maskRatio: 0.3 },
  { id: 5, label: "5 · 회상", description: "약 40% 가리기", maskRatio: 0.4 },
  { id: 6, label: "6 · 집중", description: "약 50% 가리기", maskRatio: 0.5 },
  { id: 7, label: "7 · 고난도", description: "약 60% 가리기", maskRatio: 0.6 },
  { id: 8, label: "8 · 실전", description: "약 75% 가리기", maskRatio: 0.75 },
  { id: 9, label: "9 · 완전 회상", description: "100% 가리기", maskRatio: 1 },
];

type LiteraturePaper = {
  title: string;
  meta: string;
  url: string;
  summary: string;
  gap: string;
  connection: string;
  priorContext: string;
};

type LiteratureGroup = {
  label: string;
  badge: string;
  description: string;
  papers: LiteraturePaper[];
};

type DefenseItem = {
  question: string;
  cue: string;
};

type DefenseGroup = {
  match: string;
  label: string;
  items: DefenseItem[];
};

type ResearchFlowItem =
  | {
      kind: "stage";
      stageIndex: number;
    }
  | {
      kind: "defense";
      stageIndex: number;
      groupLabel: string;
      itemIndex: number;
      totalItems: number;
      question: string;
      cue: string;
    };

const researchDefense: DefenseGroup[] = [
  {
    match: "발표 핵심 한 문장",
    label: "핵심 정의 방어",
    items: [
      {
        question: "적정 의존(calibrated reliance)을 한 문장으로 정의해보세요.",
        cue: "신뢰 최대화가 아님 → 맞는 답에는 의존 → 틀리거나 불확실하면 검증·거부 → 실제 행동으로 측정",
      },
      {
        question: "왜 의사결정 품질까지 봐야 합니까? 검증행동만 보면 안 됩니까?",
        cue: "검증 자체가 목적은 아님 → 최종적으로 더 나은 판단으로 이어지는지 확인 → 행동지표 + 성과지표 함께 측정",
      },
    ],
  },
  {
    match: "발표 첫 문장",
    label: "오프닝 방어",
    items: [
      {
        question: "사용자가 AI를 안 믿는 것보다 과신이 더 위험하다고 단정할 수 있습니까?",
        cue: "둘 다 문제라고 전제 → 핵심은 신뢰의 양이 아니라 calibration → 과신·과소신뢰 모두 비용 발생",
      },
      {
        question: "모델 정확도가 계속 높아지면 이 문제는 사라지지 않습니까?",
        cue: "오류율이 낮아져도 사용자는 개별 답의 정오를 사전에 모름 → 최신성·근거·맥락 오류는 남음 → 검증 설계 필요",
      },
    ],
  },
  {
    match: "문제 배경",
    label: "문제정의 방어",
    items: [
      {
        question: "왜 일반 생성형 AI가 아니라 업무용 RAG에 한정합니까?",
        cue: "조직 지식과 근거 문서를 명시적으로 연결 가능 → provenance 조작 가능 → 실제 업무 검증행동을 통제된 조건에서 측정하기 적합",
      },
      {
        question: "‘검증 가능한 AI’가 조직성과와 연결된다는 근거가 있습니까?",
        cue: "Tom의 actionable/domain-expert 연구 + human-AI overreliance 연구 → 기존 근거는 분절 → 내 연구가 실제 RAG 검증행동으로 연결",
      },
    ],
  },
  {
    match: "개인적 출발점",
    label: "개인 경험 방어",
    items: [
      {
        question: "GfK, 우수살롱, AskOosu를 사후적으로 억지로 연결한 것 아닙니까?",
        cue: "처음부터 하나의 연구주제로 계획한 경력은 아니라고 인정 → 반복해서 정보구조·현장판단·사용가능성 문제를 만남 → 최근 RAG 구현에서 연구질문으로 구체화",
      },
      {
        question: "AskOosu에서 실제로 어떤 문제가 있었습니까?",
        cue: "자연스러운 답변만으로 충분하지 않았음 → 오래되거나 부족한 근거 가능 → source linking·fallback logic·정보 부족 처리 필요성 경험",
      },
      {
        question: "사업 운영 경험이 AI 연구에 직접 어떤 가치를 줍니까?",
        cue: "현장에서는 완전한 정보보다 예외·암묵지·시간제약 속 판단 → AI output도 실제 workflow 안에서 검증비용과 책임 문제를 함께 봐야 한다는 관점",
      },
    ],
  },
  {
    match: "연구질문",
    label: "A. Research Question 방어",
    items: [
      {
        question: "연구질문이 너무 많은 변수를 한꺼번에 넣은 것 아닙니까?",
        cue: "umbrella question은 넓게 제시 → 실제 석사논문은 하나의 과업 + 2개 핵심 조작요인으로 축소",
      },
      {
        question: "‘지식 구조화’를 구체적으로 어떻게 조작할 겁니까?",
        cue: "chunk/문서 단위·메타데이터·근거 연결 방식 중 하나로 제한 → retrieval 성능 자체보다 사용자에게 전달되는 evidence 구조까지 연결",
      },
      {
        question: "도메인 전문가는 누구를 의미합니까?",
        cue: "선택한 업무에서 실제 판단 경험이 있는 사용자 → 경력/업무지식 기준을 사전 정의 → 일반 사용자와 구분",
      },
      {
        question: "왜 검증행동이 핵심 종속변수입니까?",
        cue: "self-reported trust와 실제 행동은 다를 수 있음 → source open·비교·수정·거부처럼 관찰 가능한 행동을 중심에 둠",
      },
    ],
  },
  {
    match: "문헌 공백",
    label: "B. Literature Gap 방어",
    items: [
      {
        question: "기존 설명가능성·신뢰 연구와 정확히 뭐가 다릅니까?",
        cue: "설명/신뢰 설문이 아니라 실제 업무 RAG → 조직지식 구조 + provenance interface → 실제 검증행동 + calibrated reliance",
      },
      {
        question: "Tom 교수 논문이 이미 domain experts의 data practice를 설명했는데, 무엇이 남아 있습니까?",
        cue: "situated practice/actionability는 설명 → 생성형 AI/RAG의 provenance·verification control을 조작해 행동 변화를 인과적으로 검증하진 않음",
      },
      {
        question: "ALCE 같은 citation 연구가 있는데 공백이라고 할 수 있습니까?",
        cue: "ALCE는 citation correctness/completeness 중심 → citation이 존재하는 것과 사용자가 실제 열어보고 판단을 바꾸는 것은 다른 질문",
      },
      {
        question: "그냥 세 문헌을 합친 연구 아닌가요? 이론적 새로움은 무엇입니까?",
        cue: "결합 자체가 기여가 아님 → knowledge representation이 verification behavior를 거쳐 calibrated reliance로 이어지는 메커니즘을 조직 과업에서 검증",
      },
    ],
  },
  {
    match: "논증·가설",
    label: "C. Arguments 방어",
    items: [
      {
        question: "출처와 불확실성을 많이 보여주면 당연히 검증이 늘어나는 것 아닙니까?",
        cue: "정보량 증가 ≠ 검증 증가 → 인지부하·시간비용 가능 → workflow fit과 verification control이 핵심 조건",
      },
      {
        question: "반대로 투명성이 성과를 떨어뜨릴 수도 있습니까?",
        cue: "가능 → 과도한 정보·경고 피로·인지부하 → 반대 결과도 경계조건 발견이라는 기여",
      },
      {
        question: "전문성과 시간압박을 왜 조절변수로 봅니까?",
        cue: "전문가는 근거 해석 능력이 다르고 → 시간압박은 검증 비용을 높임 → 같은 UI라도 행동효과가 달라질 가능성",
      },
    ],
  },
  {
    match: "방법론",
    label: "E. Methodology 방어",
    items: [
      {
        question: "왜 인터뷰와 실험을 둘 다 합니까?",
        cue: "인터뷰 = 실제 검증 맥락·변수 탐색 → 실험 = 선택한 요인의 인과효과 검증 → 탐색과 검증 역할 분리",
      },
      {
        question: "모델 성능 차이가 결과를 만든 것이라면 어떻게 합니까?",
        cue: "동일 corpus·질문·underlying output 고정 → presentation/verification layer만 조작 → 모델성능 confound 최소화",
      },
      {
        question: "calibrated reliance를 어떻게 측정합니까?",
        cue: "정답 조건에서 적절한 수용 + 오류 조건에서 적절한 거부/수정 → correctness-aware reliance 지표 + 과업 정확도",
      },
      {
        question: "행동로그는 구체적으로 무엇을 수집합니까?",
        cue: "source open 여부·횟수·체류시간·근거 비교·답변 수정·AI 답 거부·최종 선택·소요시간",
      },
      {
        question: "표본 수와 분석방법은 어떻게 정할 겁니까?",
        cue: "효과크기 가정 후 power analysis → 실험설계 확정 뒤 회귀/ANOVA 또는 mixed model 선택 → 사전등록 고려",
      },
    ],
  },
  {
    match: "학술·실무 기여",
    label: "D. Contribution 방어",
    items: [
      {
        question: "학술적 기여가 단순 UI 가이드라인 이상입니까?",
        cue: "UI 평가만 아님 → knowledge representation → verification behavior → calibrated reliance의 행동 메커니즘 제시",
      },
      {
        question: "실무적으로 이미 출처 버튼을 달면 되는 것 아닌가요?",
        cue: "존재 여부보다 언제·어떻게 제시해야 실제 사용되는지가 핵심 → 검증비용·workflow fit·전문성 조건까지 설계원칙화",
      },
    ],
  },
  {
    match: "실행 가능성·로드맵",
    label: "F. Research Plan 방어",
    items: [
      {
        question: "석사 2년 안에 인터뷰·프로토타입·실험까지 가능한가요?",
        cue: "산업 여러 개 안 함 → 한 과업·두 조작요인 → 기존 RAG 구현 역량 활용 → 단계별 scope gate 설정",
      },
      {
        question: "도메인 전문가 모집이 실패하면 어떻게 합니까?",
        cue: "접근 가능한 업무도메인부터 선정 → 파일럿은 준전문가/경험자 → 본실험 모집 가능성 확인 후 범위 확정",
      },
      {
        question: "가장 먼저 버릴 변수는 무엇입니까?",
        cue: "석사범위 우선 → provenance/verification control 중심 → freshness·uncertainty·moderator는 필요시 후순위",
      },
    ],
  },
  {
    match: "BTM·연구실 적합성",
    label: "G. Fit 방어",
    items: [
      {
        question: "왜 Tom Steinberger 교수 연구실이어야 합니까?",
        cue: "domain experts as end-users → situated data practices → actionable systems → 내 RAG verification question과 가장 직접 연결",
      },
      {
        question: "Tom 교수님이 지도하겠다고 했으니 합격할 거라고 생각합니까?",
        cue: "아님 → 교수도 admissions committee와 별개라고 명시 → 컨택은 research fit 확인일 뿐 → 선발은 별도",
      },
      {
        question: "조항정·정현주 교수 연구와는 어떻게 연결됩니까?",
        cue: "조항정 = transparency/trust/user response → 정현주 = knowledge search/recombination → 보조 이론축, 중심은 Tom의 domain-expert/actionability",
      },
      {
        question: "왜 CS/HCI가 아니라 BTM입니까?",
        cue: "CS/HCI에서도 가능 인정 → 내가 설명할 outcome은 조직업무의 검증·의존·책임·의사결정 → BTM 분석단위와 fit",
      },
    ],
  },
  {
    match: "결론",
    label: "결론 방어",
    items: [
      {
        question: "이 연구가 예상과 반대 결과가 나오면 실패입니까?",
        cue: "아님 → 더 많은 transparency가 오히려 방해될 수 있음 → 경계조건·인지부하 발견도 이론적 기여",
      },
      {
        question: "석사논문으로 가장 최소한의 성공 기준은 무엇입니까?",
        cue: "하나의 업무과업에서 한두 설계요인이 실제 verification behavior와 reliance에 미치는 효과를 명확히 검증",
      },
    ],
  },
  {
    match: "발표 마지막 문장",
    label: "마무리 방어",
    items: [
      {
        question: "결국 이 연구의 한 문장짜리 기여는 무엇입니까?",
        cue: "AI를 더 신뢰하게 만드는 연구가 아니라 → 조직지식과 검증 인터페이스 설계가 실제 검증행동과 적정 의존을 어떻게 만드는지 실증",
      },
      {
        question: "입학 후 연구주제가 달라질 가능성도 있습니까?",
        cue: "핵심 문제의식은 유지 → 변수·도메인·방법은 문헌검토와 지도에 따라 조정 → 현재 계획을 고집하는 것이 아니라 검증 가능한 질문으로 좁힘",
      },
    ],
  },
];

function defenseGroupForStage(stage: ResearchStage) {
  return researchDefense.find((group) => stage.title.includes(group.match));
}

function buildResearchFlow(stages: ResearchStage[]): ResearchFlowItem[] {
  return stages.flatMap((stage, stageIndex) => {
    const group = defenseGroupForStage(stage);
    const defenseItems: ResearchFlowItem[] = (group?.items ?? []).map((item, itemIndex) => ({
      kind: "defense",
      stageIndex,
      groupLabel: group?.label ?? "꼬리질문 방어",
      itemIndex,
      totalItems: group?.items.length ?? 0,
      question: item.question,
      cue: item.cue,
    }));

    return [{ kind: "stage", stageIndex } as ResearchFlowItem, ...defenseItems];
  });
}

const researchLiterature: LiteratureGroup[] = [
  {
    label: "Tom Steinberger · 1순위 타깃",
    badge: "CORE",
    description:
      "도메인 전문가의 실제 데이터 관행, actionable systems, 조직 맥락에서의 지식·데이터 사용을 현재 연구주제의 중심축으로 둡니다.",
    papers: [
      {
        title: "Towards Actionable Data Science: Domain Experts as End-Users of Data Science Systems",
        meta: "Jung, Steinberger & So · CSCW · 2024",
        url: "https://doi.org/10.1007/s10606-023-09475-6",
        summary:
          "도메인 전문가를 단순한 요구사항 제공자가 아니라, 실제 현장 데이터 관행을 통해 데이터사이언스 결과가 행동으로 이어질지 결정하는 최종 사용자로 봅니다. 양조 현장의 불완전하고 상황의존적인 데이터가 모델 활용 가능성을 어떻게 제한하는지 보여줍니다.",
        gap:
          "현장 데이터 관행과 actionability를 깊게 설명하지만, 생성형 AI/RAG에서 출처·최신성·불확실성·검증 기능을 어떻게 제시해야 사용자가 실제로 검증하고 적절히 의존하는지는 직접 검증하지 않습니다.",
        connection:
          "현재 연구는 이 논문의 ‘actionable for domain experts’ 문제를 workplace RAG로 옮겨, 지식 구조화와 검증 인터페이스가 검증행동과 적정 의존에 미치는 영향을 실험적으로 측정하는 확장입니다.",
        priorContext:
          "CSCW·STS의 situated data practices, domain expertise, data work 연구를 데이터사이언스 시스템 설계와 연결한 흐름입니다.",
      },
      {
        title: "How Domain Experts Work with Data: Situating Data Science in the Practices and Settings of Craftwork",
        meta: "Jung, Steinberger, King & Ackerman · PACM HCI/CSCW · 2022",
        url: "https://doi.org/10.1145/3512905",
        summary:
          "도메인 전문가는 기술 데이터사이언티스트와 달리 데이터를 추상적 예측보다 현장 맥락에 놓고 해석하며, 정밀한 예측보다 과정 통제와 유연한 대응을 위해 사용한다는 점을 보여줍니다.",
        gap:
          "도메인 전문가의 데이터 사용방식은 설명하지만, AI가 생성한 응답을 검증하는 상황에서 어떤 인터페이스·근거 정보가 그들의 실제 판단을 지원하는지는 열려 있습니다.",
        connection:
          "RAG 답변을 단순 정보 출력이 아니라 도메인 전문가의 기존 업무관행 속에 들어가는 객체로 보고, workflow fit과 verification behavior를 연구할 근거가 됩니다.",
        priorContext:
          "HCI/CSCW의 situated action과 craftwork, domain-expert-driven data science 연구를 잇습니다.",
      },
    ],
  },
  {
    label: "조항정 · 신뢰·투명성·사용자 반응",
    badge: "FIT",
    description:
      "출처·불확실성 제시가 사용자 신뢰와 행동 반응을 어떻게 바꾸는지 설명하는 IS/기술수용 관점을 보완축으로 사용합니다.",
    papers: [
      {
        title: "How the Source of AI Disclosure Shapes Psychological Mechanisms and User Responses",
        meta: "Choi & Zo · PACIS · 2026",
        url: "https://aisel.aisnet.org/pacis2026/ai_ethic/ai_ethic/6/",
        summary:
          "AI 사용 사실을 시스템이 직접 알리는지, 다른 이용자를 통해 알게 되는지에 따라 기대위반, 신뢰 훼손, 배신감, 부정적 구전이 달라질 수 있음을 시나리오 실험으로 분석합니다.",
        gap:
          "AI disclosure 이후의 심리와 플랫폼 반응에 초점을 두며, 실제 업무용 RAG에서 근거 품질과 검증 기능이 반복 사용 중 검증행동·적정 의존을 어떻게 바꾸는지는 다루지 않습니다.",
        connection:
          "현재 연구의 provenance·freshness·uncertainty 제시는 단순 정보표시가 아니라 사용자의 신뢰 형성과 검증행동을 바꾸는 disclosure/transparent design으로 연결할 수 있습니다.",
        priorContext:
          "Expectancy Violation Theory와 Attribution Theory를 AI 투명성·고지 연구에 적용하는 흐름입니다.",
      },
    ],
  },
  {
    label: "정현주 · 지식탐색·재조합·혁신",
    badge: "FIT",
    description:
      "외부 기술·지식과 기존 조직 자원의 결합이 어떤 조건에서 성과로 이어지는지 보는 혁신전략 관점과 연결합니다.",
    papers: [
      {
        title: "Boundary-spanning technology search, product component reuse, and new product innovation",
        meta: "Lee, Jung & Kwon · Research Policy · 2024",
        url: "https://doi.org/10.1016/j.respol.2024.104959",
        summary:
          "기업의 경계확장 기술탐색과 기존 제품 구성요소의 재사용이 독립적으로만 작동하는 것이 아니라, 내부·외부 출처와 재사용 경험에 따라 새로운 제품 혁신 성과가 달라진다는 것을 스마트폰 산업 데이터로 보여줍니다.",
        gap:
          "기업 수준의 기술탐색·구성요소 재조합과 혁신성과를 분석하며, 조직 내부 지식을 RAG에 구조화해 결합할 때 최종 사용자가 어떻게 검증하고 활용하는지 같은 미시적 사용 메커니즘은 범위 밖입니다.",
        connection:
          "조직의 기존 문서·업무지식과 외부 AI 역량을 단순 연결하는 것이 아니라 어떤 방식으로 재조합·구조화하느냐가 활용성과를 바꾼다는 상위 프레임을 제공합니다.",
        priorContext:
          "technology search, knowledge recombination, component reuse, attention-based view의 혁신전략 연구 흐름입니다.",
      },
      {
        title: "Platform participants hedging risk: post-alliance technology search of a platform participant and a rival platform",
        meta: "Hyun Ju Jung · Industry and Innovation · 2023",
        url: "https://doi.org/10.1080/13662716.2022.2144146",
        summary:
          "플랫폼 참여자와 소유자가 기술제휴 이후 상대와 경쟁 플랫폼의 기술을 어떻게 추가 탐색하는지 분석하며, 외부 기술과의 관계가 후속 기술탐색 방향을 바꾼다는 점을 보여줍니다.",
        gap:
          "플랫폼 생태계 수준의 전략적 기술탐색을 설명하지만, 조직 구성원이 생성형 AI와 내부 지식을 실제 업무에서 결합·검증하는 사용자 수준 메커니즘은 다루지 않습니다.",
        connection:
          "외부 AI 플랫폼에 의존하는 조직이 내부지식을 어떻게 유지·결합하고 특정 AI에 과도하게 종속되지 않을지라는 확장 논점과 연결할 수 있습니다.",
        priorContext:
          "platform ecosystem, strategic alliances, technology search, competitive hedging 연구 흐름입니다.",
      },
    ],
  },
  {
    label: "공통 선행연구 · 검증·적정 의존·Provenance",
    badge: "BASE",
    description:
      "현재 연구의 핵심 종속변수인 verification behavior와 calibrated reliance, 그리고 RAG provenance 설계의 직접적인 선행연구입니다.",
    papers: [
      {
        title: "Does the Whole Exceed its Parts? The Effect of AI Explanations on Complementary Team Performance",
        meta: "Bansal et al. · CHI · 2021",
        url: "https://doi.org/10.1145/3411764.3445717",
        summary:
          "설명이 인간-AI 팀 성능을 자동으로 높이지 않았고, 오히려 AI 권고의 정오와 무관하게 사용자가 AI를 받아들일 가능성을 높일 수 있음을 보여줍니다.",
        gap:
          "일반적인 AI 설명의 효과를 보지만, RAG의 출처·최신성·근거 연결처럼 사용자가 직접 검증할 수 있는 evidence design은 별도로 다룰 필요가 있습니다.",
        connection:
          "‘설명을 더 주면 신뢰가 좋아진다’가 아니라, 맞을 때 의존하고 틀릴 때 거부할 수 있는 calibrated reliance를 목표로 해야 한다는 근거가 됩니다.",
        priorContext:
          "Explainable AI와 human-AI complementary performance 연구의 대표적인 문제제기입니다.",
      },
      {
        title: "To Trust or to Think: Cognitive Forcing Functions Can Reduce Overreliance on AI",
        meta: "Buçinca, Malaya & Gajos · PACM HCI/CSCW · 2021",
        url: "https://doi.org/10.1145/3449287",
        summary:
          "사용자가 AI 권고를 자동으로 받아들이지 않고 한 번 더 생각하도록 만드는 cognitive forcing intervention이 단순 설명 제공보다 과의존을 줄일 수 있음을 실험으로 보여줍니다.",
        gap:
          "강제적 상호작용은 과의존을 낮추지만 주관적 선호와 비용의 trade-off가 있습니다. 실제 업무 RAG에서는 더 자연스러운 검증 컨트롤과 workflow fit이 필요합니다.",
        connection:
          "현재 연구의 verification controls를 단순 ‘출처 표시’에서 실제 검증행동을 유도하는 인터랙션 설계로 확장하는 핵심 선행연구입니다.",
        priorContext:
          "dual-process cognition, overreliance, cognitive forcing 기반의 human-AI decision support 연구입니다.",
      },
      {
        title: "Enabling Large Language Models to Generate Text with Citations",
        meta: "Gao et al. · EMNLP · 2023",
        url: "https://aclanthology.org/2023.emnlp-main.398/",
        summary:
          "LLM 답변에 citation을 붙여 사실성과 검증가능성을 높이기 위한 ALCE benchmark를 제안하고, 답변 정확도뿐 아니라 citation quality를 별도로 평가합니다.",
        gap:
          "citation 자체의 기술적 품질을 평가하지만, citation을 실제 업무 사용자가 어떻게 읽고 검증하며 의존 결정을 바꾸는지는 중심 질문이 아닙니다.",
        connection:
          "RAG에서 provenance가 기술적으로 존재하는 것과 사용자가 그것을 실제로 활용하는 것은 다른 문제라는 연구 공백을 명확하게 만듭니다.",
        priorContext:
          "attributed text generation, citation correctness/completeness, verifiable LLM generation 연구 흐름입니다.",
      },
      {
        title: "GenProve: Learning to Generate Text with Fine-Grained Provenance",
        meta: "Wei et al. · ACL · 2026",
        url: "https://aclanthology.org/2026.acl-long.228/",
        summary:
          "단순 citation을 넘어 문장별 근거가 인용·압축·추론 중 어떤 관계인지 구조화한 fine-grained provenance를 생성하는 방법을 제안하며, 추론 기반 provenance가 여전히 어렵다는 점을 보여줍니다.",
        gap:
          "세밀한 provenance 생성 성능을 개선하지만, 이런 표현 방식이 도메인 전문가의 검증시간, 오류탐지, 적정 의존, 업무성과를 어떻게 바꾸는지는 별도의 사용자·조직 연구가 필요합니다.",
        connection:
          "현재 연구가 2026년 최신 provenance 기술 연구를 받아서 ‘더 좋은 provenance 생성’이 아닌 ‘사람이 provenance를 어떻게 사용하게 설계할 것인가’를 묻도록 해줍니다.",
        priorContext:
          "fine-grained attribution/provenance와 evidence-based LLM generation의 최신 흐름입니다.",
      },
    ],
  },
];

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function shouldMaskSegment(
  index: number,
  total: number,
  difficulty: Difficulty,
  seed: string
) {
  const ratio = difficultyOptions.find((item) => item.id === difficulty)?.maskRatio ?? 0;
  if (ratio === 0 || total <= 0) return false;
  const maskedCount = Math.min(total, Math.max(1, Math.round(total * ratio)));
  const ranking = Array.from({ length: total }, (_, itemIndex) => ({
    itemIndex,
    score: stableHash(`${seed}:${itemIndex}`),
  })).sort((a, b) => a.score - b.score);
  return ranking.slice(0, maskedCount).some((item) => item.itemIndex === index);
}

function splitRevealChunks(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g).filter(Boolean);
  const chunks: { text: string; isLink: boolean }[] = [];

  for (const part of parts) {
    if (/^https?:\/\//.test(part)) {
      chunks.push({ text: part, isLink: true });
      continue;
    }

    const sentences = part
      .split(/(?<=[.!?。！？])\s+|\n+/)
      .map((item) => item.trim())
      .filter(Boolean);

    for (const sentence of sentences) {
      const words = sentence.split(/\s+/).filter(Boolean);
      for (let index = 0; index < words.length; index += 2) {
        chunks.push({ text: words.slice(index, index + 2).join(" "), isLink: false });
      }
    }
  }

  return chunks;
}

function normalizeMaskToken(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function isLowInformationChunk(value: string) {
  const normalized = normalizeMaskToken(value);
  if (normalized.length < 4) return true;

  return [
    "같습니다",
    "있습니다",
    "없습니다",
    "생각합니다",
    "말씀드리면",
    "그렇습니다",
    "수있습니다",
    "것입니다",
    "하고있습니다",
  ].includes(normalized);
}

function keywordTerms(keywords: string[]) {
  return Array.from(
    new Set(
      keywords
        .flatMap((keyword) => keyword.split(/[^0-9A-Za-z가-힣]+/g))
        .map(normalizeMaskToken)
        .filter((term) => term.length >= 2)
    )
  );
}

function chunkMatchesKeywords(value: string, keywords: string[]) {
  if (!keywords.length) return false;
  const normalized = normalizeMaskToken(value);
  if (!normalized) return false;
  return keywordTerms(keywords).some(
    (term) => normalized.includes(term) || (normalized.length >= 4 && term.includes(normalized))
  );
}

function rankIndexes(indexes: number[], seed: string) {
  return [...indexes].sort(
    (a, b) => stableHash(`${seed}:${a}`) - stableHash(`${seed}:${b}`)
  );
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapWith]] = [copy[swapWith], copy[index]];
  }
  return copy;
}

function useCountdown(initialSeconds = 45) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || seconds <= 0) return;
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          setRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, seconds]);

  const reset = (value = initialSeconds) => {
    setSeconds(value);
    setRunning(false);
  };

  return { seconds, running, setRunning, reset };
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-black text-slate-800">{value}</div>
    </div>
  );
}

const sourceBadgeClass: Record<NonNullable<InterviewQuestion["sources"]>[number], string> = {
  OFFICIAL: "bg-violet-100 text-violet-700",
  APPLICATION: "bg-cyan-100 text-cyan-700",
  ALUMNI: "bg-emerald-100 text-emerald-700",
  "FOLLOW-UP": "bg-amber-100 text-amber-700",
};

const readinessLabel = {
  ready: { label: "답변 준비됨", className: "bg-emerald-50 text-emerald-700" },
  partial: { label: "부분 준비", className: "bg-amber-50 text-amber-700" },
  recover: { label: "사실 복원 필요", className: "bg-rose-50 text-rose-700" },
} as const;

function QuestionMetaBadges({ question }: { question: InterviewQuestion }) {
  if (!question.sources?.length && !question.priority && !question.readiness) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {question.priority && (
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
            question.priority === "S"
              ? "bg-rose-100 text-rose-700"
              : question.priority === "A"
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          {question.priority} PRIORITY
        </span>
      )}
      {question.sources?.map((source) => (
        <span
          key={source}
          className={`rounded-full px-2.5 py-1 text-[10px] font-black ${sourceBadgeClass[source]}`}
        >
          {source}
        </span>
      ))}
      {question.readiness && (
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-black ${readinessLabel[question.readiness].className}`}
        >
          {readinessLabel[question.readiness].label}
        </span>
      )}
    </div>
  );
}

function ApplicationOverview({
  questions,
  selectedCategory,
  onSelectCluster,
}: {
  questions: InterviewQuestion[];
  selectedCategory: string;
  onSelectCluster: (cluster: string) => void;
}) {
  const clusters = Array.from(new Set(questions.map((item) => item.category)));

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-cyan-200 bg-white p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-slate-800">Opening + 지원서 7개 Story Cluster</div>
          <div className="mt-1 text-xs font-semibold text-slate-400">
            전체보기, Opening 또는 1~7을 눌러 해당 질문만 연속으로 연습합니다.
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black text-cyan-700">
          {questions.length} QUESTIONS
        </span>
      </div>

      <div className="flex items-stretch gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => onSelectCluster("전체")}
          className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-black transition ${
            selectedCategory === "전체"
              ? "border-cyan-300 bg-cyan-50 text-cyan-800"
              : "border-slate-200 bg-white text-slate-600"
          }`}
        >
          전체보기
        </button>
        {clusters.map((cluster, index) => {
          const count = questions.filter((item) => item.category === cluster).length;
          const shortLabel = cluster.replace(/^\d+\.\s*/, "");
          const clusterNumber = cluster.match(/^(\d+)\./)?.[1] ?? String(index + 1);
          return (
            <button
              key={cluster}
              type="button"
              onClick={() => onSelectCluster(cluster)}
              className={`min-w-[150px] shrink-0 rounded-xl border px-3 py-3 text-left transition ${
                selectedCategory === cluster
                  ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <div className="text-[10px] font-black text-cyan-500">
                {clusterNumber === "0" ? "OPENING" : clusterNumber}
              </div>
              <div className="mt-1 line-clamp-2 text-xs font-black leading-5">{shortLabel}</div>
              <div className="mt-1 text-[10px] font-bold text-slate-400">{count}문항</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ResearchLiteraturePanel() {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-violet-200 bg-white">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 marker:hidden sm:px-5">
          <div className="min-w-0">
            <div className="text-sm font-black text-slate-800">교수별 논문 · 선행연구 · 연구공백</div>
            <div className="mt-1 text-xs font-semibold leading-5 text-slate-400">
              Tom 교수 연구를 중심축으로 두고 조항정·정현주 교수와 공통 선행연구까지 연결합니다.
            </div>
          </div>
          <ChevronDown className="h-5 w-5 shrink-0 text-violet-500" />
        </summary>

        <div className="space-y-4 border-t border-violet-100 bg-violet-50/30 p-3 sm:p-5">
          {researchLiterature.map((group) => (
            <details
              key={group.label}
              open={group.badge === "CORE"}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-4 marker:hidden">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-slate-800">{group.label}</span>
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-700">
                      {group.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                    {group.description}
                  </p>
                </div>
                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              </summary>

              <div className="space-y-3 border-t border-slate-100 p-3 sm:p-4">
                {group.papers.map((paper) => (
                  <article key={paper.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <a
                      href={paper.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-black leading-6 text-slate-900 underline decoration-violet-300 underline-offset-4 hover:text-violet-700"
                    >
                      {paper.title} ↗
                    </a>
                    <div className="mt-1 text-[11px] font-bold text-slate-400">{paper.meta}</div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-xl bg-white p-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-500">논문 요약</div>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{paper.summary}</p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-500">이 field에서 남는 공백</div>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{paper.gap}</p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-600">내 연구와의 연결</div>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{paper.connection}</p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">선행연구 맥락</div>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{paper.priorContext}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </details>
          ))}
        </div>
      </details>
    </section>
  );
}

function ResearchDefenseCard({
  stage,
  item,
  flowIndex,
  flowTotal,
  onPrevious,
  onNext,
}: {
  stage: ResearchStage;
  item: Extract<ResearchFlowItem, { kind: "defense" }>;
  flowIndex: number;
  flowTotal: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const [showCue, setShowCue] = useState(false);
  const timer = useCountdown(40);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-3 flex items-center justify-between gap-3 text-sm font-bold text-slate-400">
        <span>{flowIndex + 1} / {flowTotal}</span>
        <span className="truncate">{stage.title.split("/")[0]}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-300"
          style={{ width: `${((flowIndex + 1) / Math.max(1, flowTotal)) * 100}%` }}
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-[28px] border border-amber-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="border-b border-amber-100 bg-amber-50/40 p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-white">
                FOLLOW-UP {item.itemIndex + 1}/{item.totalItems}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                {item.groupLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (timer.seconds === 0) timer.reset();
                timer.setRunning(!timer.running);
              }}
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black transition ${
                timer.running ? "bg-rose-100 text-rose-700" : "bg-white text-slate-600"
              }`}
            >
              <Mic2 className="h-4 w-4" /> {timer.seconds}s
            </button>
          </div>
          <h2 className="mt-7 text-2xl font-black leading-snug tracking-tight text-slate-900 sm:text-3xl">
            {item.question}
          </h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
            방금 연습한 <strong>{stage.title.split("/")[0]}</strong> 내용을 근거로 먼저 20~40초 안에 답해보세요.
          </p>
        </div>

        <div className="p-5 sm:p-8">
          <button
            type="button"
            onClick={() => setShowCue((current) => !current)}
            className="flex w-full items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-left font-black text-amber-900"
          >
            <span className="flex items-center gap-3">
              <Target className="h-5 w-5" /> 답변 cue 보기
            </span>
            <ChevronDown className={`h-5 w-5 transition ${showCue ? "rotate-180" : ""}`} />
          </button>
          {showCue && (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-slate-50 p-4 text-sm font-bold leading-7 text-slate-700">
              {item.cue}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onPrevious}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-4 font-black text-slate-600"
        >
          <ChevronLeft className="h-5 w-5" /> 이전
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 font-black text-white"
        >
          다음 <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function RatingButtons({
  value,
  onChange,
}: {
  value?: Rating;
  onChange: (rating: Rating) => void;
}) {
  const options: { id: Rating; label: string; className: string }[] = [
    { id: "again", label: "다시", className: "border-rose-200 bg-rose-50 text-rose-700" },
    { id: "unsure", label: "애매", className: "border-amber-200 bg-amber-50 text-amber-700" },
    {
      id: "mastered",
      label: "외움",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-xl border px-3 py-3 text-sm font-extrabold transition hover:-translate-y-0.5 ${
            value === option.id
              ? `${option.className} ring-2 ring-slate-900/10`
              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function KeywordPath({
  keywords,
  difficulty,
  seed,
}: {
  keywords: string[];
  difficulty: Difficulty;
  seed: string;
}) {
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  if (!keywords.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {keywords.map((keyword, index) => {
        const masked = shouldMaskSegment(index, keywords.length, difficulty, seed);
        const isRevealed = revealed.has(index);
        return (
        <div key={`${keyword}-${index}`} className="flex max-w-full items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!masked) return;
              setRevealed((current) => new Set(current).add(index));
            }}
            className="inline-flex max-w-full items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-left text-sm font-bold text-cyan-900"
            aria-label={masked && !isRevealed ? "가려진 키워드 보기" : undefined}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[10px] font-black text-cyan-700 sm:hidden">
              {index + 1}
            </span>
            <span
              className={`break-keep transition duration-200 ${
                masked && !isRevealed
                  ? difficulty >= 7
                    ? "cursor-pointer select-none blur-[6px]"
                    : "cursor-pointer select-none blur-[4px]"
                  : ""
              }`}
            >
              {keyword}
            </span>
          </button>
          {index < keywords.length - 1 && (
            <ChevronRight className="hidden h-4 w-4 shrink-0 text-cyan-300 sm:block" />
          )}
        </div>
      )})}
    </div>
  );
}

function BilingualKeywordPanel({
  korean,
  english,
  difficulty,
  seed,
}: {
  korean: string[];
  english: string[];
  difficulty: Difficulty;
  seed: string;
}) {
  return (
    <div className="space-y-4">
      {korean.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            한국어 키워드
          </div>
          <KeywordPath
            key={`${seed}-ko-${difficulty}`}
            keywords={korean}
            difficulty={difficulty}
            seed={`${seed}-ko`}
          />
        </div>
      )}
      {english.length > 0 && (
        <div className={korean.length > 0 ? "border-t border-slate-100 pt-4" : ""}>
          <div className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            English keywords
          </div>
          <KeywordPath
            key={`${seed}-en-${difficulty}`}
            keywords={english}
            difficulty={difficulty}
            seed={`${seed}-en`}
          />
        </div>
      )}
    </div>
  );
}

function shortLinkLabel(url: string) {
  if (url.includes("btm.kaist.ac.kr") && url.toLowerCase().includes(".pdf")) {
    return "KAIST BTM 교과과정 PDF";
  }
  if (url.includes("kaist.ac.kr")) return "KAIST 링크";
  return "링크 열기";
}

function MaskedRichText({
  text,
  className,
  difficulty,
  seed,
  focusKeywords = [],
}: {
  text: string;
  className: string;
  difficulty: Difficulty;
  seed: string;
  focusKeywords?: string[];
}) {
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const chunks = splitRevealChunks(text);
  const meaningfulIndexes = chunks
    .map((chunk, index) => ({ chunk, index }))
    .filter(({ chunk }) => !chunk.isLink && !isLowInformationChunk(chunk.text))
    .map(({ index }) => index);
  const keywordIndexes = meaningfulIndexes.filter((index) =>
    chunkMatchesKeywords(chunks[index].text, focusKeywords)
  );
  const nonKeywordIndexes = meaningfulIndexes.filter((index) => !keywordIndexes.includes(index));
  const prioritizedIndexes = [
    ...rankIndexes(keywordIndexes, `${seed}:keyword`),
    ...rankIndexes(nonKeywordIndexes, `${seed}:content`),
  ];
  const maskRatio = difficultyOptions.find((item) => item.id === difficulty)?.maskRatio ?? 0;
  const maskedCount =
    maskRatio === 0
      ? 0
      : Math.min(
          meaningfulIndexes.length,
          Math.max(1, Math.round(meaningfulIndexes.length * maskRatio))
        );
  const maskedIndexes = new Set(prioritizedIndexes.slice(0, maskedCount));

  return (
    <p className={`${className} min-w-0 break-words`}>
      {chunks.map((chunk, index) => {
        if (chunk.isLink) {
          return (
            <span key={`${seed}-${index}`} className="mr-1 inline-block">
              <a
                href={chunk.text}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full items-center rounded-lg bg-cyan-50 px-2 py-1 font-extrabold text-cyan-700 underline decoration-cyan-300 underline-offset-2 hover:bg-cyan-100"
              >
                {shortLinkLabel(chunk.text)}
              </a>
            </span>
          );
        }

        const masked = maskedIndexes.has(index);
        const isRevealed = revealed.has(index);

        return (
          <button
            key={`${seed}-${index}`}
            type="button"
            onClick={() => {
              if (!masked) return;
              setRevealed((current) => new Set(current).add(index));
            }}
            className={`mr-1 inline border-0 bg-transparent p-0 text-left font-inherit text-inherit transition duration-200 ${
              masked && !isRevealed
                ? difficulty >= 7
                  ? "cursor-pointer select-none blur-[6px]"
                  : "cursor-pointer select-none blur-[4px]"
                : "cursor-text"
            }`}
            aria-label={masked && !isRevealed ? "가려진 답변 부분 보기" : undefined}
          >
            {chunk.text}
          </button>
        );
      })}
    </p>
  );
}

function AudioPlayButton({ src, label }: { src: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const audio = new Audio(src);
    audio.preload = "none";
    audioRef.current = audio;

    const handleEnded = () => setPlaying(false);
    const handleError = () => {
      setPlaying(false);
      setFailed(true);
    };
    const handleOtherPlayback = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === src || audio.paused) return;
      audio.pause();
      setPlaying(false);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    window.addEventListener("btm-audio-play", handleOtherPlayback);

    return () => {
      audio.pause();
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      window.removeEventListener("btm-audio-play", handleOtherPlayback);
      audioRef.current = null;
    };
  }, [src]);

  if (failed) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (playing) {
          audio.pause();
          setPlaying(false);
          return;
        }

        window.dispatchEvent(new CustomEvent("btm-audio-play", { detail: src }));
        try {
          await audio.play();
          setPlaying(true);
        } catch {
          setFailed(true);
          setPlaying(false);
        }
      }}
      className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
      aria-label={playing ? `${label} 일시정지` : label}
    >
      {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      {playing ? "일시정지" : label}
    </button>
  );
}

function AnswerPanel({
  question,
  difficulty,
  language,
}: {
  question: InterviewQuestion;
  difficulty: Difficulty;
  language: PracticeLanguage;
}) {
  const english = language === "en";
  const answerText = english ? question.englishAnswer : question.answer || question.summary;
  const answerKeywords = english ? question.englishKeywords : question.keywords;
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div>
        <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
          {english ? "English example" : "Korean example"}
        </div>
        {answerText ? (
          <>
            <MaskedRichText
              key={`${question.id}-${language}-answer-${difficulty}`}
              text={answerText}
              className="whitespace-pre-line text-[15px] font-medium leading-7 text-slate-700"
              difficulty={difficulty}
              seed={`${question.id}-${language}-answer`}
              focusKeywords={answerKeywords}
            />
            {question.speakable !== false &&
              (!question.audioLanguages || question.audioLanguages.includes(language)) && (
              <AudioPlayButton
                src={`/audio/interview/${question.id}-${language}.mp3`}
                label={english ? "English answer" : "한국어 답변 듣기"}
              />
            )}
          </>
        ) : (
          <p className="text-sm font-bold text-amber-600">
            {english ? "영어 예시 답변은 아직 준비되지 않았습니다." : "예시 답변은 아직 준비되지 않았습니다."}
          </p>
        )}
        {question.speakable === false && (
          <p className="mt-3 text-xs font-bold text-amber-600">
            사실 복원이 필요한 항목이라 암기용 오디오에서는 제외했습니다.
          </p>
        )}
      </div>
    </div>
  );
}

function Flashcard({
  question,
  rating,
  onRate,
  onPrevious,
  onNext,
  position,
  total,
  difficulty,
  language,
  onLanguageChange,
}: {
  question: InterviewQuestion;
  rating?: Rating;
  onRate: (rating: Rating) => void;
  onPrevious: () => void;
  onNext: () => void;
  position: number;
  total: number;
  difficulty: Difficulty;
  language: PracticeLanguage;
  onLanguageChange: (language: PracticeLanguage) => void;
}) {
  const [showKeywords, setShowKeywords] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const timer = useCountdown(45);
  const englishAvailable = Boolean(question.englishQuestion && question.englishAnswer);
  const activeLanguage: PracticeLanguage = language === "en" && !englishAvailable ? "ko" : language;
  const questionText = activeLanguage === "en" ? question.englishQuestion : question.question;
  const keywords = activeLanguage === "en" ? question.englishKeywords : question.keywords;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-3 flex items-center justify-between gap-3 text-sm font-bold text-slate-400">
        <span>{position + 1} / {total}</span>
        <span className="truncate">{question.category}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-cyan-500 transition-all duration-300"
          style={{ width: `${((position + 1) / Math.max(1, total)) * 100}%` }}
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-100 p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white">
                {question.displayNumber ?? `Q${question.number}`}
              </span>
              {question.core && (
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-700">
                  CORE
                </span>
              )}
              <QuestionMetaBadges question={question} />
            </div>
            <button
              type="button"
              onClick={() => {
                if (timer.seconds === 0) timer.reset();
                timer.setRunning(!timer.running);
              }}
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black transition ${
                timer.running
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Mic2 className="h-4 w-4" />
              {timer.seconds}s {timer.running ? "말하는 중" : "말하기"}
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
              <Languages className="ml-2 h-4 w-4 text-slate-400" />
              {(["ko", "en"] as PracticeLanguage[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={value === "en" && !englishAvailable}
                  onClick={() => onLanguageChange(value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                    activeLanguage === value
                      ? "bg-slate-900 text-white"
                      : value === "en" && !englishAvailable
                        ? "cursor-not-allowed text-slate-300"
                        : "text-slate-500 hover:bg-white"
                  }`}
                >
                  {value === "ko" ? "한국어" : "English"}
                </button>
              ))}
            </div>
            {question.category === "0. Opening" && (
              <span className="hidden text-xs font-bold text-cyan-600 sm:block">English 우선 연습</span>
            )}
          </div>

          <h2 className="mt-7 text-2xl font-black leading-snug tracking-tight text-slate-900 sm:text-3xl">
            {questionText}
          </h2>

          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Step 1
                </div>
                <p className="mt-1 text-sm font-bold text-slate-600">
                  먼저 아무것도 보지 말고 입으로 답하세요.
                </p>
              </div>
              <Brain className="h-7 w-7 text-slate-300" />
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-8">
          <button
            type="button"
            onClick={() => setShowKeywords((current) => !current)}
            className="flex w-full items-center justify-between rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-4 text-left transition hover:bg-cyan-100"
          >
            <span className="flex items-center gap-3 font-black text-cyan-900">
              <Target className="h-5 w-5" />
              Step 2 · 키워드만 보기
            </span>
            {showKeywords ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
          {showKeywords && (
            <div className="rounded-2xl border border-cyan-100 bg-white p-4">
              <KeywordPath
                key={`${question.id}-${language}-${difficulty}`}
                keywords={keywords}
                difficulty={difficulty}
                seed={`${question.id}-${language}`}
              />
              {activeLanguage === "ko" && question.summary && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <MaskedRichText
                    key={`${question.id}-summary-${difficulty}`}
                    text={question.summary}
                    className="text-sm font-semibold leading-6 text-slate-500"
                    difficulty={difficulty}
                    seed={`${question.id}-summary`}
                    focusKeywords={question.keywords}
                  />
                </div>
              )}
              {activeLanguage === "en" && question.englishKeyPoint && (
                <div className="mt-4 border-t border-slate-100 pt-3 text-sm font-bold leading-6 text-cyan-700">
                  Key point · {question.englishKeyPoint}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAnswer((current) => !current)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left font-black text-slate-700 transition hover:bg-slate-50"
          >
            <span className="flex items-center gap-3">
              <BookOpen className="h-5 w-5" />
              Step 3 · 예시 답변 펼쳐보기
            </span>
            <ChevronDown className={`h-5 w-5 transition ${showAnswer ? "rotate-180" : ""}`} />
          </button>
          {showAnswer && <AnswerPanel question={question} difficulty={difficulty} language={activeLanguage} />}

          <div className="pt-2">
            <p className="mb-2 text-center text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              방금 답변은 어땠나요?
            </p>
            <RatingButtons value={rating} onChange={onRate} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onPrevious}
          className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-4 font-black text-slate-600 hover:bg-slate-50"
        >
          <ChevronLeft className="h-5 w-5" /> 이전
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 font-black text-white hover:bg-slate-800"
        >
          다음 <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function ResearchCard({
  stage,
  index,
  total,
  onNext,
  onPrevious,
  difficulty,
}: {
  stage: ResearchStage;
  index: number;
  total: number;
  onNext: () => void;
  onPrevious: () => void;
  difficulty: Difficulty;
}) {
  const [showKeywords, setShowKeywords] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const timer = useCountdown(stage.time ? 60 : 45);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-5 flex gap-1.5">
        {Array.from({ length: total }).map((_, stageIndex) => (
          <div
            key={stageIndex}
            className={`h-2 flex-1 rounded-full ${stageIndex <= index ? "bg-violet-500" : "bg-slate-100"}`}
          />
        ))}
      </div>
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-100 p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">
            {stage.time ?? `PART ${index + 1}`}
          </span>
          <button
            type="button"
            onClick={() => timer.setRunning(!timer.running)}
            className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"
          >
            <Clock3 className="h-4 w-4" /> {timer.seconds}s
          </button>
        </div>
        <h2 className="mt-6 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
          {stage.title}
        </h2>
        <div className="mt-6 rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-violet-400">
                Step 1
              </div>
              <p className="mt-1 text-sm font-extrabold leading-6 text-violet-800">
                제목만 보고 이 구간을 먼저 입으로 설명하세요.
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-violet-500 sm:text-sm">
                문장을 외우기보다 다음 단계로 이어지는 논리를 복구합니다.
              </p>
            </div>
            <Brain className="h-7 w-7 shrink-0 text-violet-300" />
          </div>
        </div>
        </div>

        <div className="space-y-4 p-5 sm:p-8">
          <button
            type="button"
            onClick={() => setShowKeywords((current) => !current)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 text-left transition hover:bg-violet-100"
          >
            <span className="flex min-w-0 items-center gap-3 font-black leading-snug text-violet-900">
              <Target className="h-5 w-5 shrink-0" />
              <span>Step 2 · 키워드만 보기</span>
            </span>
            {showKeywords ? (
              <EyeOff className="h-5 w-5 shrink-0" />
            ) : (
              <Eye className="h-5 w-5 shrink-0" />
            )}
          </button>

          {showKeywords && (
            <div className="rounded-2xl border border-violet-100 bg-white p-4">
              <BilingualKeywordPanel
                korean={stage.keywords}
                english={stage.englishKeywords.length ? stage.englishKeywords : [stage.english]}
                difficulty={difficulty}
                seed={stage.id}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAnswer((current) => !current)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left font-black leading-snug text-slate-700 transition hover:bg-slate-50"
          >
            <span className="flex min-w-0 items-center gap-3">
              <BookOpen className="h-5 w-5 shrink-0" />
              <span>Step 3 · 예시 발표문 펼쳐보기</span>
            </span>
            <ChevronDown className={`h-5 w-5 shrink-0 transition ${showAnswer ? "rotate-180" : ""}`} />
          </button>

          {showAnswer && (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Korean example
                </div>
                <MaskedRichText
                  key={`${stage.id}-ko-answer-${difficulty}`}
                  text={stage.korean}
                  className="whitespace-pre-line text-[15px] font-semibold leading-7 text-slate-700"
                  difficulty={difficulty}
                  seed={`${stage.id}-ko-answer`}
                  focusKeywords={stage.keywords}
                />
                <AudioPlayButton
                  src={`/audio/interview/${stage.id}-ko.mp3`}
                  label="한국어 발표 듣기"
                />
              </div>
              <div className="border-t border-slate-200 pt-4">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  English example
                </div>
                <MaskedRichText
                  key={`${stage.id}-en-answer-${difficulty}`}
                  text={stage.english}
                  className="whitespace-pre-line text-sm font-medium leading-7 text-slate-500"
                  difficulty={difficulty}
                  seed={`${stage.id}-en-answer`}
                  focusKeywords={stage.englishKeywords}
                />
                <AudioPlayButton
                  src={`/audio/interview/${stage.id}-en.mp3`}
                  label="English presentation"
                />
              </div>
            </div>
          )}

        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onPrevious}
          className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-4 text-sm font-black text-slate-600 sm:gap-2 sm:text-base"
        >
          <ChevronLeft className="h-5 w-5 shrink-0" /> 이전
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-violet-600 px-2 py-4 text-sm font-black text-white sm:gap-2 sm:text-base"
        >
          다음 <ChevronRight className="h-5 w-5 shrink-0" />
        </button>
      </div>
    </div>
  );
}

export function InterviewTrainer({
  content,
  initialResearchStage,
}: {
  content: InterviewContent;
  initialResearchStage?: number;
}) {
  const initialStageIndex =
    initialResearchStage &&
    initialResearchStage >= 1 &&
    initialResearchStage <= content.researchStages.length
      ? initialResearchStage - 1
      : 0;
  const initialResearchFlow = buildResearchFlow(content.researchStages);
  const requestedFlowIndex = initialResearchFlow.findIndex(
    (item) => item.kind === "stage" && item.stageIndex === initialStageIndex
  );
  const [section, setSection] = useState<Section>(
    initialResearchStage ? "research" : "application"
  );
  const [deck, setDeck] = useState<Deck>("core");
  const [progress, setProgress] = useState<SavedProgress>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [researchIndex, setResearchIndex] = useState(initialStageIndex);
  const [researchFlowIndex, setResearchFlowIndex] = useState(
    requestedFlowIndex >= 0 ? requestedFlowIndex : 0
  );
  const [randomOrder, setRandomOrder] = useState<string[]>([]);
  const [category, setCategory] = useState("전체");
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [applicationLanguage, setApplicationLanguage] = useState<PracticeLanguage>("en");
  const [showStats, setShowStats] = useState(false);
  const [showDifficulty, setShowDifficulty] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("kaist-interview-progress-v1");
      if (stored) {
        const parsed = JSON.parse(stored) as SavedProgress;
        window.setTimeout(() => setProgress(parsed), 0);
      }
    } catch {
      // Ignore malformed local progress.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("kaist-interview-progress-v1", JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    const stored = window.localStorage.getItem("kaist-interview-difficulty-v2");
    const parsed = Number(stored);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 9) {
      window.setTimeout(() => setDifficulty(parsed as Difficulty), 0);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("kaist-interview-difficulty-v2", String(difficulty));
  }, [difficulty]);

  const activeQuestions = useMemo(
    () => (section === "application" ? content.applicationQuestions : []),
    [content.applicationQuestions, section]
  );

  const researchFlow = useMemo(
    () => buildResearchFlow(content.researchStages),
    [content.researchStages]
  );

  const deckQuestions = useMemo(() => {
    let selected = deck === "core" ? activeQuestions.filter((item) => item.core) : activeQuestions;
    if (deck === "weak")
      selected = selected.filter((item) => progress[item.id] !== "mastered");
    if (category !== "전체") selected = selected.filter((item) => item.category === category);
    if (randomOrder.length) {
      const order = new Map(randomOrder.map((id, index) => [id, index]));
      return [...selected].sort(
        (a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999)
      );
    }
    return selected;
  }, [activeQuestions, category, deck, progress, randomOrder]);

  const mastered = activeQuestions.filter((item) => progress[item.id] === "mastered").length;
  const unsure = activeQuestions.filter((item) => progress[item.id] === "unsure").length;
  const again = activeQuestions.filter((item) => progress[item.id] === "again").length;
  const currentQuestion = deckQuestions[questionIndex];
  const currentResearch = content.researchStages[researchIndex];
  const currentResearchFlowItem = researchFlow[researchFlowIndex];

  const rate = (question: InterviewQuestion, rating: Rating) => {
    setProgress((current) => ({ ...current, [question.id]: rating }));
  };

  const moveQuestion = (direction: 1 | -1) => {
    if (!deckQuestions.length) return;
    setQuestionIndex((current) =>
      (current + direction + deckQuestions.length) % deckQuestions.length
    );
  };

  const shuffleDeck = () => {
    setRandomOrder(shuffle(deckQuestions).map((item) => item.id));
    setQuestionIndex(0);
  };

  const changeSection = (nextSection: Section) => {
    setSection(nextSection);
    setDeck("core");
    setCategory("전체");
    setRandomOrder([]);
    setQuestionIndex(0);
  };

  const goToResearchStage = (stageIndex: number) => {
    const flowIndex = researchFlow.findIndex(
      (item) => item.kind === "stage" && item.stageIndex === stageIndex
    );
    setResearchIndex(stageIndex);
    if (flowIndex >= 0) setResearchFlowIndex(flowIndex);
  };

  const moveResearchFlow = (direction: 1 | -1) => {
    if (!researchFlow.length) return;
    const nextIndex =
      (researchFlowIndex + direction + researchFlow.length) % researchFlow.length;
    const nextItem = researchFlow[nextIndex];
    setResearchFlowIndex(nextIndex);
    setResearchIndex(nextItem.stageIndex);
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f9fc] text-slate-900">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight">KAIST BTM 면접 준비</div>
              <div className="text-xs font-bold text-slate-400">장우수 · 2027 Spring · Active Recall</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/audio"
              className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800"
            >
              <Headphones className="h-4 w-4" />
              <span>Audio</span>
            </Link>
            <Link
              href="/visual"
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
            >
              <Network className="h-4 w-4" />
              <span>Visual</span>
            </Link>
            <div
              className={`hidden rounded-full px-3 py-1.5 text-xs font-bold lg:block ${
                content.loadedFromLocalNotionMirror
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {content.loadedFromLocalNotionMirror ? "Local content override" : "Bundled content"}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            onClick={() => changeSection("application")}
            className={`relative rounded-2xl border px-4 py-4 text-left transition sm:px-5 ${
              section === "application"
                ? "border-cyan-300 bg-cyan-50 ring-2 ring-cyan-100"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <FileText
              className={`absolute right-4 top-4 h-6 w-6 ${
                section === "application" ? "text-cyan-600" : "text-slate-300"
              }`}
            />
            <div className="pr-10 text-base font-black tracking-tight text-slate-900">
              <span className="text-cyan-500">PART 1.</span> Application Defense
            </div>
            <div className="mt-1 pr-10 text-xs font-semibold text-slate-400">
              제출지원서 · 경력 · 활동 · 일반면접
            </div>
          </button>
          <button
            type="button"
            onClick={() => changeSection("research")}
            className={`relative rounded-2xl border px-4 py-4 text-left transition sm:px-5 ${
              section === "research"
                ? "border-violet-300 bg-violet-50 ring-2 ring-violet-100"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <Presentation
              className={`absolute right-4 top-4 h-6 w-6 ${
                section === "research" ? "text-violet-600" : "text-slate-300"
              }`}
            />
            <div className="pr-10 text-base font-black tracking-tight text-slate-900">
              <span className="text-violet-500">PART 2.</span> 연구주제 발표 · Defense
            </div>
            <div className="mt-1 pr-10 text-xs font-semibold text-slate-400">
              연구주제 · 방법론 · 문헌 · 교수 적합성 보조 대비
            </div>
          </button>
        </section>

        {section !== "research" && (
        <section className="mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowStats((current) => !current)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5"
            aria-expanded={showStats}
          >
            <div className="flex min-w-0 items-center gap-3">
              <ListFilter className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="text-sm font-black text-slate-700">학습 현황</span>
              <span className="truncate text-xs font-bold text-slate-400">
                현재 파트 {activeQuestions.length}문항
              </span>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition ${showStats ? "rotate-180" : ""}`}
            />
          </button>
          {showStats && (
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 p-3 sm:grid-cols-4 sm:p-4">
              <Stat label="현재 질문" value={`${activeQuestions.length}`} icon={<ListFilter className="h-4 w-4" />} />
              <Stat label="외움" value={`${mastered}`} icon={<Check className="h-4 w-4" />} />
              <Stat label="애매" value={`${unsure}`} icon={<Flame className="h-4 w-4" />} />
              <Stat label="다시" value={`${again}`} icon={<RotateCcw className="h-4 w-4" />} />
            </div>
          )}
        </section>
        )}

        <section className="mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowDifficulty((current) => !current)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5"
            aria-expanded={showDifficulty}
          >
            <div className="min-w-0">
              <div className="text-sm font-black text-slate-800">암기 난이도</div>
              <div className="mt-0.5 text-xs font-bold text-slate-400">
                {difficultyOptions.find((item) => item.id === difficulty)?.label} · {Math.round((difficultyOptions.find((item) => item.id === difficulty)?.maskRatio ?? 0) * 100)}%
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition ${showDifficulty ? "rotate-180" : ""}`}
            />
          </button>
          {showDifficulty && (
            <div className="border-t border-slate-100 p-4 sm:p-5">
              <div className="mb-3 text-xs font-semibold leading-5 text-slate-400">
                낮은 난이도에서는 핵심 키워드부터 가리고, 난이도가 올라갈수록 나머지 내용어까지 가립니다. 100%에서는 종결어미·접속어를 제외한 거의 모든 핵심 내용을 회상합니다.
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-4 sm:px-4">
                <input
                  type="range"
                  min={1}
                  max={9}
                  step={1}
                  value={difficulty}
                  onChange={(event) => setDifficulty(Number(event.target.value) as Difficulty)}
                  aria-label="암기 난이도"
                  className="h-2 w-full cursor-pointer accent-slate-900"
                />
                <div className="mt-3 grid grid-cols-9 gap-0 text-center text-[10px] font-bold text-slate-400 sm:text-xs">
                  {difficultyOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDifficulty(option.id)}
                      className={`min-w-0 px-0.5 py-1 transition ${
                        difficulty === option.id ? "font-black text-slate-900" : "hover:text-slate-600"
                      }`}
                      aria-label={`${option.label}, ${option.description}`}
                    >
                      {Math.round(option.maskRatio * 100)}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                  <span className="text-xs font-bold text-slate-400">0% · 안내</span>
                  <span className="text-center text-xs font-black text-slate-700">
                    {difficultyOptions.find((item) => item.id === difficulty)?.description}
                  </span>
                  <span className="text-xs font-bold text-slate-400">100% · 완전 회상</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {section === "application" ? (
          <>
            <ApplicationOverview
              questions={content.applicationQuestions}
              selectedCategory={category}
              onSelectCluster={(cluster) => {
                setCategory(cluster);
                setDeck("all");
                setRandomOrder([]);
                setQuestionIndex(0);
              }}
            />

            <section className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
              <div className="flex flex-wrap gap-2">
                {([
                  ["core", "S급 질문"],
                  ["weak", "아직 못 외운 것"],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setDeck(id);
                      setRandomOrder([]);
                      setQuestionIndex(0);
                    }}
                    className={`rounded-xl px-3 py-2 text-sm font-extrabold ${
                      deck === id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={shuffleDeck}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-extrabold text-slate-600"
              >
                <Shuffle className="h-4 w-4" /> 섞기
              </button>
            </section>

            {currentQuestion ? (
              <Flashcard
                key={currentQuestion.id}
                question={currentQuestion}
                rating={progress[currentQuestion.id]}
                onRate={(rating) => rate(currentQuestion, rating)}
                onPrevious={() => moveQuestion(-1)}
                onNext={() => moveQuestion(1)}
                position={questionIndex}
                total={deckQuestions.length}
                difficulty={difficulty}
                language={applicationLanguage}
                onLanguageChange={setApplicationLanguage}
              />
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
                <Check className="mx-auto h-10 w-10 text-emerald-500" />
                <h2 className="mt-4 text-xl font-black">이 필터의 질문을 모두 외웠습니다.</h2>
                <p className="mt-2 text-sm text-slate-400">전체보기로 돌아가 다시 연습해보세요.</p>
              </div>
            )}
          </>
        ) : currentResearch && currentResearchFlowItem ? (
          <div>
            <section className="mb-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 sm:p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-500">
                Current research topic · Tom Steinberger first
              </div>
              <h2 className="mt-2 text-lg font-black leading-7 tracking-tight text-slate-900 sm:text-xl">
                조직 업무용 RAG에서 지식 구조화와 검증 인터페이스 설계가 도메인 전문가의 검증행동과 적정 의존에 미치는 영향
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                조직의 문서·운영지식이 어떤 구조로 RAG에 연결되고, 출처·최신성·불확실성·검증 기능이 어떻게 제시될 때 도메인 전문가가 실제로 확인하고 적절히 의존하는지를 연구합니다. 의사결정 품질은 최종 성과지표로 확인합니다.
              </p>
            </section>

            <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-800">10분 발표 지도</div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">
                    구간을 눌러 바로 이동할 수 있습니다.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => goToResearchStage(0)}
                  className="rounded-xl bg-violet-50 p-2 text-violet-600"
                  aria-label="처음부터"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {content.researchStages.map((stage, index) => (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => goToResearchStage(index)}
                    className={`min-w-[112px] snap-start rounded-xl border px-3 py-3 text-left transition sm:min-w-[124px] ${
                      researchIndex === index
                        ? "border-violet-300 bg-violet-50 text-violet-800"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    <div className="text-[11px] font-black text-violet-400">{stage.time ?? `${index + 1}`}</div>
                    <div className="mt-1 line-clamp-2 text-xs font-extrabold">{stage.title.split("/")[0]}</div>
                  </button>
                ))}
              </div>
            </section>
            {currentResearchFlowItem.kind === "stage" ? (
              <ResearchCard
                key={`stage-${currentResearch.id}-${researchFlowIndex}`}
                stage={currentResearch}
                index={researchIndex}
                total={content.researchStages.length}
                difficulty={difficulty}
                onPrevious={() => moveResearchFlow(-1)}
                onNext={() => moveResearchFlow(1)}
              />
            ) : (
              <ResearchDefenseCard
                key={`defense-${researchFlowIndex}`}
                stage={content.researchStages[currentResearchFlowItem.stageIndex]}
                item={currentResearchFlowItem}
                flowIndex={researchFlowIndex}
                flowTotal={researchFlow.length}
                onPrevious={() => moveResearchFlow(-1)}
                onNext={() => moveResearchFlow(1)}
              />
            )}

            <div className="mt-6">
              <ResearchLiteraturePanel />
            </div>
          </div>
        ) : null}

        <footer className="mx-auto mt-12 max-w-3xl border-t border-slate-200 py-6 text-center text-xs font-semibold leading-5 text-slate-400">
          공개용 bundled content snapshot을 사용합니다. 답변을 외우기 전에 반드시 질문만 보고 먼저 말하세요.
        </footer>
      </div>
    </main>
  );
}
