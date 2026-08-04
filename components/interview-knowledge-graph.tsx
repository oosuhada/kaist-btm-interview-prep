"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ExternalLink,
  Headphones,
  Layers3,
  Network,
  Play,
  Route,
  RotateCcw,
  ShieldCheck,
  Square,
  User,
} from "lucide-react";

type Mode = "research" | "faculty" | "experience" | "pressure" | "integrated";
type NodeKind = "core" | "concept" | "faculty" | "paper" | "experience" | "question";

type GraphNode = {
  id: string;
  label: string;
  subtitle?: string;
  x: number;
  y: number;
  width?: number;
  kind: NodeKind;
  summary: string;
  cue?: string;
  bullets?: string[];
  url?: string;
};

type GraphEdge = {
  from: string;
  to: string;
  label?: string;
};

type GraphZone = {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "research" | "experience" | "faculty" | "defense";
};

type GraphData = {
  title: string;
  description: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  path?: string[];
  expandable?: Record<string, string[]>;
  viewBox?: { width: number; height: number; minWidth?: number };
  zones?: GraphZone[];
};

const graphs: Record<Mode, GraphData> = {
  research: {
    title: "Research Map",
    description: "연구질문의 원인 → 설계 → 행동 → 결과 흐름을 한 번에 복구합니다.",
    nodes: [
      {
        id: "org-knowledge",
        label: "조직 문서·운영지식",
        subtitle: "Organizational knowledge",
        x: 40,
        y: 80,
        kind: "concept",
        summary: "업무용 RAG가 참조하는 내부 문서, 운영지식, 현장 맥락입니다.",
        cue: "무엇을 넣느냐보다 어떤 구조와 맥락으로 연결하느냐가 중요",
      },
      {
        id: "knowledge-structure",
        label: "지식 구조화",
        subtitle: "Knowledge structuring",
        x: 245,
        y: 80,
        kind: "concept",
        summary: "문서 단위, chunk, metadata, 근거 연결 방식 등 RAG가 지식을 조직하는 층입니다.",
        cue: "석사논문에서는 조작요인을 하나 또는 두 개로 좁힘",
      },
      {
        id: "rag",
        label: "Workplace RAG",
        subtitle: "현재 연구의 중심 시스템",
        x: 450,
        y: 80,
        kind: "core",
        summary: "조직 업무용 RAG에서 지식 구조화와 검증 인터페이스가 도메인 전문가의 실제 사용행동을 어떻게 바꾸는지 연구합니다.",
        cue: "Tom 교수의 domain experts + actionable systems 문제를 생성형 AI/RAG로 확장",
      },
      {
        id: "verification-ui",
        label: "검증 인터페이스",
        subtitle: "Provenance · Freshness · Uncertainty",
        x: 655,
        y: 80,
        kind: "concept",
        summary: "출처, 최신성, 불확실성, 원문 열기·근거 비교 기능을 사용자가 실제 업무 흐름에서 어떻게 보게 할지의 문제입니다.",
        cue: "정보를 많이 보여주는 것이 아니라 실제 검증으로 이어지는 설계",
      },
      {
        id: "domain-expert",
        label: "도메인 전문가",
        subtitle: "Domain experts",
        x: 40,
        y: 330,
        kind: "concept",
        summary: "선택한 업무에서 실제 판단 경험과 맥락지식을 가진 사용자입니다.",
        cue: "일반 사용자보다 situated knowledge와 판단 책임이 있음",
      },
      {
        id: "workflow-fit",
        label: "Workflow Fit",
        subtitle: "업무 흐름 적합성",
        x: 245,
        y: 330,
        kind: "concept",
        summary: "검증 정보와 기능이 업무 흐름을 방해하지 않고 필요한 순간에 사용될 수 있는지 봅니다.",
        cue: "같은 UI라도 시간압박·전문성에 따라 효과가 달라질 수 있음",
      },
      {
        id: "verification-behavior",
        label: "검증 행동",
        subtitle: "Verification behavior",
        x: 450,
        y: 330,
        kind: "core",
        summary: "출처 열기, 근거 비교, 답변 수정, 오류 답변 거부 등 실제 관찰 가능한 행동입니다.",
        cue: "self-reported trust보다 실제 행동을 핵심 결과로 측정",
        bullets: ["source open", "evidence compare", "revise", "reject", "time spent"],
      },
      {
        id: "calibrated-reliance",
        label: "적정 의존",
        subtitle: "Calibrated reliance",
        x: 655,
        y: 330,
        kind: "core",
        summary: "맞는 답에는 적절히 의존하고, 틀리거나 불확실한 답에는 검증·수정·거부하는 상태입니다.",
        cue: "신뢰를 높이는 것이 목표가 아니라 correctness-aware reliance가 목표",
      },
      {
        id: "decision-quality",
        label: "의사결정 품질",
        subtitle: "Decision quality",
        x: 820,
        y: 330,
        width: 140,
        kind: "concept",
        summary: "검증과 적정 의존이 최종적으로 더 나은 업무 판단과 과업 성과로 이어지는지 확인하는 성과지표입니다.",
        cue: "검증 자체가 목적이 아니라 더 나은 판단이 최종 목적",
      },
    ],
    edges: [
      { from: "org-knowledge", to: "knowledge-structure", label: "structured as" },
      { from: "knowledge-structure", to: "rag", label: "feeds" },
      { from: "rag", to: "verification-ui", label: "presents via" },
      { from: "domain-expert", to: "workflow-fit", label: "works within" },
      { from: "workflow-fit", to: "verification-behavior", label: "enables" },
      { from: "verification-ui", to: "verification-behavior", label: "shapes" },
      { from: "rag", to: "verification-behavior", label: "used through" },
      { from: "domain-expert", to: "verification-behavior", label: "performs" },
      { from: "verification-behavior", to: "calibrated-reliance", label: "calibrates" },
      { from: "calibrated-reliance", to: "decision-quality", label: "improves" },
    ],
    path: [
      "org-knowledge",
      "knowledge-structure",
      "rag",
      "verification-ui",
      "verification-behavior",
      "calibrated-reliance",
      "decision-quality",
    ],
  },
  faculty: {
    title: "Faculty & Literature",
    description: "Tom 교수를 중심축으로, 다른 교수·선행연구가 어느 부분을 보완하는지 연결합니다.",
    nodes: [
      {
        id: "tom",
        label: "Tom Steinberger",
        subtitle: "1순위 · CORE",
        x: 60,
        y: 80,
        kind: "faculty",
        summary: "도메인 전문가, situated data practices, actionable data science가 현재 연구의 가장 직접적인 지적 기반입니다.",
        cue: "내 연구의 중심: domain experts → workflow → verification → actionability",
      },
      {
        id: "zo",
        label: "조항정",
        subtitle: "Transparency · Trust",
        x: 60,
        y: 270,
        kind: "faculty",
        summary: "AI 투명성, 신뢰, 사용자 반응 관점에서 provenance와 uncertainty 표시의 효과를 설명하는 보조축입니다.",
        cue: "trust 자체보다 transparency → psychology → behavior 연결",
      },
      {
        id: "jung",
        label: "정현주",
        subtitle: "Knowledge recombination",
        x: 60,
        y: 460,
        kind: "faculty",
        summary: "기존 조직지식과 외부 기술·AI 역량을 어떻게 탐색하고 재조합하는지 보는 혁신전략의 상위 프레임입니다.",
        cue: "보조축: organizational knowledge + external AI capability",
      },
      {
        id: "research-core",
        label: "내 연구주제",
        subtitle: "Workplace RAG verification",
        x: 405,
        y: 260,
        width: 180,
        kind: "core",
        summary: "조직 업무용 RAG에서 지식 구조화와 검증 인터페이스가 도메인 전문가의 검증행동·적정 의존에 미치는 영향을 연구합니다.",
        cue: "Tom을 중심으로 Zo의 trust/transparency, Jung의 knowledge recombination을 보조 연결",
      },
      {
        id: "tom-paper-1",
        label: "Towards Actionable Data Science",
        subtitle: "CSCW · 2024",
        x: 700,
        y: 40,
        width: 215,
        kind: "paper",
        summary: "도메인 전문가를 실제 data science system의 end-user로 보고, 현장 데이터 관행이 actionability를 어떻게 좌우하는지 보여줍니다.",
        cue: "남는 공백: RAG provenance/verification control의 인과효과",
        url: "https://doi.org/10.1007/s10606-023-09475-6",
      },
      {
        id: "tom-paper-2",
        label: "How Domain Experts Work with Data",
        subtitle: "PACM HCI/CSCW · 2022",
        x: 700,
        y: 145,
        width: 215,
        kind: "paper",
        summary: "도메인 전문가가 데이터를 현장 맥락 속에서 해석하며 정밀 예측보다 과정 통제와 유연한 대응을 중시한다는 점을 보여줍니다.",
        cue: "남는 공백: 생성형 AI 답변을 검증하는 interface와 workflow",
        url: "https://doi.org/10.1145/3512905",
      },
      {
        id: "zo-paper",
        label: "Source of AI Disclosure",
        subtitle: "PACIS · 2026",
        x: 700,
        y: 270,
        width: 215,
        kind: "paper",
        summary: "AI 고지의 출처에 따라 기대위반, 신뢰 훼손, 배신감, 사용자 반응이 달라질 수 있음을 분석합니다.",
        cue: "연결: provenance/uncertainty 표시가 심리와 행동을 바꾸는 메커니즘",
        url: "https://aisel.aisnet.org/pacis2026/ai_ethic/ai_ethic/6/",
      },
      {
        id: "jung-paper",
        label: "Boundary-spanning Technology Search",
        subtitle: "Research Policy · 2024",
        x: 700,
        y: 430,
        width: 215,
        kind: "paper",
        summary: "외부 기술탐색과 기존 구성요소 재사용의 결합이 혁신성과에 어떤 차이를 만드는지 분석합니다.",
        cue: "연결: 내부 조직지식 + 외부 AI 역량의 재조합",
        url: "https://doi.org/10.1016/j.respol.2024.104959",
      },
      {
        id: "base-paper",
        label: "Human-AI Reliance Studies",
        subtitle: "Bansal · Buçinca · ALCE",
        x: 405,
        y: 480,
        width: 180,
        kind: "paper",
        summary: "설명은 과의존을 자동으로 해결하지 않으며, 실제 검증행동을 유도하는 intervention과 citation/provenance 연구가 필요하다는 선행연구 흐름입니다.",
        cue: "공통 gap: provenance가 존재하는 것과 실제 사용자가 활용하는 것은 다름",
      },
    ],
    edges: [
      { from: "tom", to: "research-core", label: "primary fit" },
      { from: "zo", to: "research-core", label: "trust lens" },
      { from: "jung", to: "research-core", label: "strategy lens" },
      { from: "tom", to: "tom-paper-1", label: "researches" },
      { from: "tom", to: "tom-paper-2", label: "researches" },
      { from: "zo", to: "zo-paper", label: "researches" },
      { from: "jung", to: "jung-paper", label: "researches" },
      { from: "base-paper", to: "research-core", label: "prior work" },
    ],
    path: ["tom", "tom-paper-2", "tom-paper-1", "research-core", "base-paper"],
  },
  experience: {
    title: "Experience → Research",
    description: "경력이 산만한 목록이 아니라 ‘직접 시도 → 다음 질문 발견’의 반복이라는 것을 복구합니다.",
    nodes: [
      {
        id: "identity",
        label: "직접 시도해보고 답을 찾는 사람",
        subtitle: "Interview identity",
        x: 370,
        y: 250,
        width: 245,
        kind: "core",
        summary: "새로운 문제를 밖에서만 분석하지 않고 직접 해보고, 그 과정에서 다음 질문을 찾는 행동 패턴이 경력 전체를 관통합니다.",
        cue: "시도 → 관찰 → 질문 → 다음 시도",
      },
      {
        id: "gfk",
        label: "GfK Korea",
        subtitle: "시장 데이터",
        x: 70,
        y: 70,
        kind: "experience",
        summary: "글로벌 POS 데이터를 다루며 데이터가 실제 비즈니스 판단에 쓰이는 과정을 경험했습니다.",
        cue: "data → business decision",
      },
      {
        id: "salon",
        label: "우수살롱",
        subtitle: "약 5년 창업·운영",
        x: 70,
        y: 250,
        kind: "experience",
        summary: "직접 고객과 현장을 상대하며 매뉴얼 밖의 암묵지, 예외, 책임 있는 판단을 경험했습니다.",
        cue: "현장 판단 → tacit knowledge → responsibility",
      },
      {
        id: "ux-dev",
        label: "UX · 개발",
        subtitle: "기술을 직접 학습",
        x: 70,
        y: 430,
        kind: "experience",
        summary: "기술을 외부 전문영역으로만 두지 않고 UX와 개발을 직접 배우며 기획과 구현의 거리를 줄였습니다.",
        cue: "문제를 말하는 데서 끝내지 않고 직접 구현",
      },
      {
        id: "ask-oosu",
        label: "AskOosu",
        subtitle: "RAG 구현",
        x: 700,
        y: 115,
        kind: "experience",
        summary: "자연스러운 답변보다 어떤 자료를 근거로 했는지, 정보가 부족할 때 한계를 어떻게 드러낼지가 중요하다는 문제를 경험했습니다.",
        cue: "source linking · fallback · insufficient evidence",
      },
      {
        id: "codemap",
        label: "CodeMap",
        subtitle: "AI 서비스 구현",
        x: 700,
        y: 300,
        kind: "experience",
        summary: "AI 서비스를 직접 구현하며 기술 이해와 실제 product execution을 이어갔습니다.",
        cue: "prototype을 직접 만들 수 있는 연구 준비도",
      },
      {
        id: "research-question",
        label: "조직 AI 연구질문",
        subtitle: "KAIST BTM",
        x: 700,
        y: 485,
        kind: "core",
        summary: "직접 시도하며 반복해서 마주친 정보·판단·사용 문제를 이제 연구방법론과 실험으로 검증하려고 합니다.",
        cue: "경험을 하나 더 쌓는 대신 경험에서 나온 질문을 연구로 검증",
      },
    ],
    edges: [
      { from: "gfk", to: "identity", label: "data practice" },
      { from: "salon", to: "identity", label: "field practice" },
      { from: "ux-dev", to: "identity", label: "build practice" },
      { from: "identity", to: "ask-oosu", label: "direct attempt" },
      { from: "identity", to: "codemap", label: "direct attempt" },
      { from: "ask-oosu", to: "research-question", label: "revealed gap" },
      { from: "codemap", to: "research-question", label: "build evidence" },
      { from: "identity", to: "research-question", label: "next step" },
    ],
    path: ["gfk", "salon", "ux-dev", "identity", "ask-oosu", "research-question"],
  },
  pressure: {
    title: "Pressure Map",
    description: "7개 공식 연구계획 블록을 누르면 가장 위험한 꼬리질문과 방어 논리를 빠르게 복구합니다.",
    nodes: [
      {
        id: "defense-core",
        label: "10분 연구계획 방어",
        subtitle: "7 blocks",
        x: 390,
        y: 250,
        width: 200,
        kind: "core",
        summary: "발표 내용 자체보다 교수의 후속 질문에 논리적으로 방어할 수 있는지가 핵심입니다.",
        cue: "RQ → Gap → Argument → Contribution → Method → Plan → Fit",
      },
      {
        id: "rq",
        label: "A. Research Question",
        x: 65,
        y: 55,
        width: 180,
        kind: "question",
        summary: "연구질문의 범위, 변수, 도메인 전문가 정의를 방어합니다.",
        cue: "umbrella는 넓게 → 실제 논문은 한 과업 + 2개 조작요인",
        bullets: ["변수가 너무 많은 것 아닌가?", "지식 구조화를 어떻게 조작할 것인가?", "도메인 전문가는 누구인가?"],
      },
      {
        id: "gap",
        label: "B. Literature Gap",
        x: 300,
        y: 55,
        width: 180,
        kind: "question",
        summary: "Tom 연구, human-AI reliance, RAG provenance 사이에서 실제로 무엇이 비어 있는지 방어합니다.",
        cue: "세 문헌을 합치는 게 아니라 knowledge representation → verification behavior → calibrated reliance 메커니즘을 검증",
        bullets: ["기존 XAI 연구와 뭐가 다른가?", "Tom 논문이 이미 한 것 아닌가?", "ALCE가 있는데 gap인가?"],
      },
      {
        id: "argument",
        label: "C. Arguments",
        x: 535,
        y: 55,
        width: 180,
        kind: "question",
        summary: "정보를 더 많이 주면 무조건 좋은 것이 아니라는 핵심 주장을 방어합니다.",
        cue: "정보량 증가 ≠ 검증 증가 → cognitive load · time cost · workflow fit",
        bullets: ["투명성이 오히려 성과를 낮출 수 있나?", "전문성·시간압박을 왜 보나?"],
      },
      {
        id: "contribution",
        label: "D. Contribution",
        x: 770,
        y: 55,
        width: 180,
        kind: "question",
        summary: "단순 UI 가이드가 아니라 행동 메커니즘과 실제 업무 설계 원칙이라는 기여를 방어합니다.",
        cue: "knowledge representation → verification → reliance라는 연결이 학술적 기여",
        bullets: ["UI 가이드라인 이상의 기여인가?", "출처 버튼만 달면 되는 것 아닌가?"],
      },
      {
        id: "method",
        label: "E. Methodology",
        x: 170,
        y: 470,
        width: 180,
        kind: "question",
        summary: "인터뷰와 통제실험의 역할, confound 통제, 행동로그, 표본·분석을 방어합니다.",
        cue: "interview = 탐색 / experiment = 인과검증 / same output = confound control",
        bullets: ["왜 인터뷰와 실험 둘 다?", "모델 성능 차이는 어떻게 통제?", "calibrated reliance는 어떻게 측정?"],
      },
      {
        id: "plan",
        label: "F. Research Plan",
        x: 405,
        y: 470,
        width: 180,
        kind: "question",
        summary: "석사 2년 안에 실제로 가능한지, scope와 참가자 모집 리스크를 방어합니다.",
        cue: "한 업무과업 + 두 조작요인 + 기존 RAG 구현역량 활용",
        bullets: ["2년 안에 가능한가?", "도메인 전문가 모집 실패하면?", "가장 먼저 버릴 변수는?"],
      },
      {
        id: "fit",
        label: "G. Fit",
        x: 640,
        y: 470,
        width: 180,
        kind: "question",
        summary: "왜 KAIST BTM, 왜 Tom 교수, 다른 교수와 어떻게 연결되는지 방어합니다.",
        cue: "Tom = primary intellectual anchor / Zo·Jung = complementary lenses",
        bullets: ["왜 Tom 교수 연구실인가?", "컨택이 합격 보장인가?", "왜 CS/HCI가 아니라 BTM인가?"],
      },
    ],
    edges: [
      { from: "rq", to: "defense-core", label: "define" },
      { from: "gap", to: "defense-core", label: "justify" },
      { from: "argument", to: "defense-core", label: "argue" },
      { from: "contribution", to: "defense-core", label: "contribute" },
      { from: "defense-core", to: "method", label: "test with" },
      { from: "defense-core", to: "plan", label: "execute as" },
      { from: "defense-core", to: "fit", label: "fits with" },
    ],
    path: ["rq", "gap", "argument", "contribution", "method", "plan", "fit"],
  },
  integrated: {
    title: "Integrated Knowledge Graph",
    description: "경력·연구·교수·면접 방어를 하나의 중심 맵에서 필요할 때만 펼쳐 봅니다.",
    viewBox: { width: 1180, height: 800, minWidth: 980 },
    zones: [
      { label: "RESEARCH", x: 210, y: 20, width: 760, height: 245, kind: "research" },
      { label: "EXPERIENCE", x: 20, y: 295, width: 300, height: 475, kind: "experience" },
      { label: "FACULTY · LITERATURE", x: 860, y: 295, width: 300, height: 475, kind: "faculty" },
      { label: "DEFENSE", x: 330, y: 570, width: 520, height: 205, kind: "defense" },
    ],
    nodes: [
      {
        id: "integrated-center",
        label: "장우수 · KAIST BTM",
        subtitle: "Experience → Research → Fit → Defense",
        x: 485,
        y: 345,
        width: 210,
        kind: "core",
        summary: "경험에서 발견한 문제를 연구질문으로 만들고, 교수·문헌과 연결한 뒤 면접에서 방어하는 전체 구조의 중심입니다.",
        cue: "직접 시도 → 문제 발견 → 연구 설계 → 교수 fit → defense",
      },
      {
        id: "experience-hub",
        label: "Experience",
        subtitle: "왜 이 질문을 갖게 됐는가",
        x: 80,
        y: 355,
        width: 180,
        kind: "experience",
        summary: "GfK, 우수살롱, UX·개발, AskOosu를 하나의 문제발견 과정으로 묶습니다.",
        cue: "직접 시도해보고 답을 찾는 사람",
      },
      {
        id: "research-hub",
        label: "Research",
        subtitle: "무엇을 검증할 것인가",
        x: 500,
        y: 55,
        width: 180,
        kind: "core",
        summary: "Workplace RAG에서 지식구조와 검증설계가 검증행동과 적정 의존을 어떻게 바꾸는지 연구합니다.",
        cue: "knowledge structure → verification → calibrated reliance",
      },
      {
        id: "faculty-hub",
        label: "Faculty & Literature",
        subtitle: "누구의 연구와 연결되는가",
        x: 920,
        y: 355,
        width: 190,
        kind: "faculty",
        summary: "Tom 교수를 중심으로 조항정·정현주 교수와 공통 선행연구를 보조축으로 연결합니다.",
        cue: "Tom primary / Zo transparency / Jung recombination",
      },
      {
        id: "pressure-hub",
        label: "Defense",
        subtitle: "어디를 공격받을 것인가",
        x: 500,
        y: 600,
        width: 180,
        kind: "question",
        summary: "RQ·Gap·Argument·Contribution·Method·Plan·Fit의 논리적 빈틈을 방어합니다.",
        cue: "발표문 암기보다 왜? 어떻게? 무엇이 다른가?에 답하기",
      },
      { id: "i-gfk", label: "GfK", x: 55, y: 475, kind: "experience", summary: "시장 데이터가 의사결정으로 바뀌는 과정을 경험했습니다.", cue: "data → decision" },
      { id: "i-salon", label: "우수살롱", x: 55, y: 585, kind: "experience", summary: "현장 암묵지와 예외 속에서 직접 판단하고 운영했습니다.", cue: "tacit knowledge → field judgment" },
      { id: "i-askoosu", label: "AskOosu", x: 55, y: 685, kind: "experience", summary: "RAG를 직접 구현하며 근거·최신성·fallback 문제를 경험했습니다.", cue: "source → freshness → fallback" },
      { id: "i-rag", label: "Workplace RAG", x: 250, y: 165, kind: "core", summary: "현재 연구의 시스템 맥락입니다.", cue: "organizational knowledge + AI" },
      { id: "i-verification", label: "검증 행동", x: 505, y: 165, kind: "core", summary: "출처 열기·비교·수정·거부처럼 실제 행동을 봅니다.", cue: "behavior, not trust alone" },
      { id: "i-reliance", label: "적정 의존", x: 760, y: 165, kind: "core", summary: "맞을 때 수용하고 틀릴 때 확인·거부하는 상태입니다.", cue: "correctness-aware reliance" },
      { id: "i-tom", label: "Tom Steinberger", x: 925, y: 475, kind: "faculty", summary: "Domain experts, situated practices, actionable systems가 가장 직접적인 연구 anchor입니다.", cue: "primary intellectual fit" },
      { id: "i-zo", label: "조항정", x: 925, y: 585, kind: "faculty", summary: "AI transparency·trust·user response를 설명하는 보조축입니다.", cue: "transparency → response" },
      { id: "i-jung", label: "정현주", x: 925, y: 685, kind: "faculty", summary: "조직지식과 외부 AI 역량의 탐색·재조합이라는 상위 전략 관점입니다.", cue: "knowledge recombination" },
      { id: "i-gap", label: "Literature Gap", x: 350, y: 700, kind: "question", summary: "세 연구 흐름이 실제 업무 RAG의 검증행동으로 충분히 연결되지 않았다는 공백입니다.", cue: "situated practice + reliance + provenance" },
      { id: "i-method", label: "Method", x: 660, y: 700, kind: "question", summary: "인터뷰로 탐색하고, 동일 output 기반 통제실험으로 인과효과를 검증합니다.", cue: "interview → prototype → experiment" },
    ],
    edges: [
      { from: "experience-hub", to: "integrated-center", label: "motivates" },
      { from: "research-hub", to: "integrated-center", label: "defines" },
      { from: "faculty-hub", to: "integrated-center", label: "supports" },
      { from: "integrated-center", to: "pressure-hub", label: "must defend" },
      { from: "i-gfk", to: "experience-hub", label: "experience" },
      { from: "i-salon", to: "experience-hub", label: "experience" },
      { from: "i-askoosu", to: "experience-hub", label: "reveals gap" },
      { from: "research-hub", to: "i-rag", label: "context" },
      { from: "i-rag", to: "i-verification", label: "shapes" },
      { from: "i-verification", to: "i-reliance", label: "calibrates" },
      { from: "faculty-hub", to: "i-tom", label: "primary" },
      { from: "faculty-hub", to: "i-zo", label: "trust lens" },
      { from: "faculty-hub", to: "i-jung", label: "strategy lens" },
      { from: "pressure-hub", to: "i-gap", label: "defend gap" },
      { from: "pressure-hub", to: "i-method", label: "defend method" },
    ],
    path: ["experience-hub", "integrated-center", "research-hub", "faculty-hub", "pressure-hub"],
    expandable: {
      "experience-hub": ["i-gfk", "i-salon", "i-askoosu"],
      "research-hub": ["i-rag", "i-verification", "i-reliance"],
      "faculty-hub": ["i-tom", "i-zo", "i-jung"],
      "pressure-hub": ["i-gap", "i-method"],
    },
  },
};

const modeMeta: { id: Mode; label: string; icon: typeof Network }[] = [
  { id: "research", label: "Research", icon: Network },
  { id: "faculty", label: "Faculty", icon: BookOpen },
  { id: "experience", label: "Experience", icon: BriefcaseBusiness },
  { id: "pressure", label: "Pressure", icon: ShieldCheck },
  { id: "integrated", label: "Integrated", icon: Layers3 },
];

const nodeStageLinks: Record<Mode, Record<string, number>> = {
  research: {
    "org-knowledge": 5,
    "knowledge-structure": 5,
    rag: 5,
    "verification-ui": 5,
    "domain-expert": 5,
    "workflow-fit": 7,
    "verification-behavior": 5,
    "calibrated-reliance": 1,
    "decision-quality": 9,
  },
  faculty: {
    tom: 11,
    zo: 11,
    jung: 11,
    "research-core": 11,
    "tom-paper-1": 6,
    "tom-paper-2": 6,
    "zo-paper": 6,
    "jung-paper": 6,
    "base-paper": 6,
  },
  experience: {
    identity: 4,
    gfk: 4,
    salon: 4,
    "ux-dev": 4,
    "ask-oosu": 4,
    codemap: 4,
    "research-question": 5,
  },
  pressure: {
    "defense-core": 5,
    rq: 5,
    gap: 6,
    argument: 7,
    contribution: 9,
    method: 8,
    plan: 10,
    fit: 11,
  },
  integrated: {
    "integrated-center": 1,
    "experience-hub": 4,
    "research-hub": 5,
    "faculty-hub": 11,
    "pressure-hub": 5,
    "i-gfk": 4,
    "i-salon": 4,
    "i-askoosu": 4,
    "i-rag": 5,
    "i-verification": 5,
    "i-reliance": 1,
    "i-tom": 11,
    "i-zo": 11,
    "i-jung": 11,
    "i-gap": 6,
    "i-method": 8,
  },
};

function edgeKey(edge: GraphEdge) {
  return `${edge.from}:${edge.to}`;
}

function nodeStyle(kind: NodeKind, selected: boolean) {
  if (selected) return { fill: "#0f172a", stroke: "#0f172a", text: "#ffffff", sub: "#cbd5e1" };
  if (kind === "core") return { fill: "#f5f3ff", stroke: "#8b5cf6", text: "#4c1d95", sub: "#7c3aed" };
  if (kind === "faculty") return { fill: "#ecfeff", stroke: "#06b6d4", text: "#164e63", sub: "#0891b2" };
  if (kind === "paper") return { fill: "#fffbeb", stroke: "#f59e0b", text: "#78350f", sub: "#b45309" };
  if (kind === "experience") return { fill: "#ecfdf5", stroke: "#10b981", text: "#064e3b", sub: "#059669" };
  if (kind === "question") return { fill: "#fff7ed", stroke: "#f97316", text: "#7c2d12", sub: "#ea580c" };
  return { fill: "#ffffff", stroke: "#cbd5e1", text: "#1e293b", sub: "#64748b" };
}

function centerOf(node: GraphNode) {
  return { x: node.x + (node.width ?? 170) / 2, y: node.y + 38 };
}

function splitNodeLabel(label: string, maxChars: number) {
  if (label.length <= maxChars) return [label];
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return [label.slice(0, maxChars), label.slice(maxChars, maxChars * 2)];
  }

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === 1) break;
  }
  if (lines.length < 2 && current) lines.push(current);
  return lines.slice(0, 2);
}

type MemoryScene = {
  kicker: string;
  title: string;
  accent: string;
  description: string;
  sequence: string[];
  orbit: string[];
  cue: string;
  targetMode: Mode;
  targetNode: string;
  tone: "violet" | "cyan" | "emerald" | "orange" | "rose";
};

const memoryScenes: MemoryScene[] = [
  {
    kicker: "01 · RESEARCH STORY",
    title: "정보를 더 보여주는 AI가 아니라",
    accent: "검증하게 만드는 AI",
    description: "내 연구를 한 장면으로 기억합니다. 조직지식이 RAG를 거쳐 답변이 되고, 검증행동이 적정 의존으로 이어집니다.",
    sequence: ["조직지식", "Workplace RAG", "검증 행동", "적정 의존"],
    orbit: ["PROVENANCE", "WORKFLOW", "BEHAVIOR", "RELIANCE"],
    cue: "trust를 높이는 연구가 아니다 → correctness-aware reliance를 만든다",
    targetMode: "research",
    targetNode: "rag",
    tone: "violet",
  },
  {
    kicker: "02 · EXPERIENCE STORY",
    title: "경력이 여러 개인 게 아니라",
    accent: "질문이 진화해 왔다",
    description: "데이터를 보고, 현장을 운영하고, 직접 만들고, RAG를 구현하면서 같은 질문을 더 깊게 파고들었습니다.",
    sequence: ["GfK", "우수살롱", "UX · 개발", "AskOosu", "Research"],
    orbit: ["DATA", "FIELD", "BUILD", "QUESTION"],
    cue: "직접 시도 → 관찰 → 문제 발견 → 다음 시도 → 연구로 검증",
    targetMode: "experience",
    targetNode: "identity",
    tone: "emerald",
  },
  {
    kicker: "03 · FACULTY FIT",
    title: "교수 이름을 외우는 게 아니라",
    accent: "내 질문과 연결한다",
    description: "Tom은 domain experts와 actionable systems의 중심축, Zo와 Jung은 transparency와 knowledge recombination의 보조축입니다.",
    sequence: ["Domain experts", "Tom", "내 연구", "Zo · Jung"],
    orbit: ["SITUATED", "ACTIONABLE", "TRUST", "RECOMBINE"],
    cue: "Tom = primary intellectual anchor / 다른 교수 = complementary lenses",
    targetMode: "faculty",
    targetNode: "research-core",
    tone: "cyan",
  },
  {
    kicker: "04 · PRESSURE DEFENSE",
    title: "발표문을 외우는 게 아니라",
    accent: "논리의 빈틈을 막는다",
    description: "교수의 질문은 결국 왜 이 질문인지, 기존 연구와 뭐가 다른지, 어떻게 검증할지, 왜 KAIST인지로 수렴합니다.",
    sequence: ["RQ", "GAP", "ARGUMENT", "METHOD", "FIT"],
    orbit: ["WHY?", "SO WHAT?", "HOW?", "WHY BTM?"],
    cue: "RQ → Gap → Argument → Contribution → Method → Plan → Fit",
    targetMode: "pressure",
    targetNode: "defense-core",
    tone: "orange",
  },
  {
    kicker: "05 · INTERVIEW IDENTITY",
    title: "나는 답을 아는 사람이 아니라",
    accent: "직접 확인하는 사람",
    description: "새로운 문제를 밖에서 분석하는 데서 멈추지 않고 직접 시도하고, 관찰하고, 다음 질문을 찾아 연구로 연결합니다.",
    sequence: ["TRY", "OBSERVE", "QUESTION", "TEST", "LEARN"],
    orbit: ["EXECUTION", "CURIOSITY", "EVIDENCE", "RESEARCH"],
    cue: "Experience → Research → Fit → Defense 를 하나의 자기소개 서사로 묶기",
    targetMode: "integrated",
    targetNode: "integrated-center",
    tone: "rose",
  },
];

const sceneTone: Record<MemoryScene["tone"], { glow: string; text: string; pill: string; dot: string }> = {
  violet: {
    glow: "from-violet-500/30 via-fuchsia-500/10 to-transparent",
    text: "text-violet-300",
    pill: "border-violet-400/25 bg-violet-400/10 text-violet-100",
    dot: "bg-violet-300",
  },
  cyan: {
    glow: "from-cyan-400/30 via-sky-500/10 to-transparent",
    text: "text-cyan-300",
    pill: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
    dot: "bg-cyan-300",
  },
  emerald: {
    glow: "from-emerald-400/30 via-teal-500/10 to-transparent",
    text: "text-emerald-300",
    pill: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
    dot: "bg-emerald-300",
  },
  orange: {
    glow: "from-orange-400/30 via-amber-500/10 to-transparent",
    text: "text-orange-300",
    pill: "border-orange-400/25 bg-orange-400/10 text-orange-100",
    dot: "bg-orange-300",
  },
  rose: {
    glow: "from-rose-400/30 via-pink-500/10 to-transparent",
    text: "text-rose-300",
    pill: "border-rose-400/25 bg-rose-400/10 text-rose-100",
    dot: "bg-rose-300",
  },
};

function MemoryCinema({ onJump }: { onJump: (mode: Mode, nodeId: string) => void }) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const scene = memoryScenes[sceneIndex];
  const tone = sceneTone[scene.tone];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setSceneIndex((current) => (current + 1) % memoryScenes.length);
    }, 6200);
    return () => window.clearInterval(timer);
  }, [playing]);

  const orbitPositions = [
    "left-[6%] top-[13%]",
    "right-[5%] top-[20%]",
    "left-[3%] bottom-[18%]",
    "right-[7%] bottom-[12%]",
  ];

  return (
    <section className="relative mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-[#070b16] text-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.glow}`} />
      <div className="visual-cinema-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="visual-cinema-scan pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      <div className="visual-cinema-orb visual-cinema-orb-a pointer-events-none absolute h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="visual-cinema-orb visual-cinema-orb-b pointer-events-none absolute h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative grid min-h-[440px] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-black tracking-[0.18em] text-white/60">
                VISUAL MEMORY CINEMA
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black tracking-[0.14em] text-emerald-200">
                <span className="visual-live-dot h-1.5 w-1.5 rounded-full bg-emerald-300" /> AUTO · 6.2s
              </span>
            </div>

            <div key={`copy-${sceneIndex}`} className="visual-cinema-enter mt-8">
              <div className={`text-xs font-black tracking-[0.2em] ${tone.text}`}>{scene.kicker}</div>
              <h1 className="mt-3 max-w-3xl text-[clamp(2rem,5vw,4.7rem)] font-black leading-[0.98] tracking-[-0.055em] text-white">
                {scene.title}
                <br />
                <span className={tone.text}>{scene.accent}</span>
              </h1>
              <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-slate-300 sm:text-base">{scene.description}</p>
            </div>
          </div>

          <div className="mt-8">
            <div key={`sequence-${sceneIndex}`} className="flex flex-wrap items-center gap-2">
              {scene.sequence.map((item, index) => (
                <div key={item} className="flex items-center gap-2">
                  <span
                    className={`visual-cinema-step rounded-xl border px-3 py-2 text-[11px] font-black sm:text-xs ${tone.pill}`}
                    style={{ animationDelay: `${index * 110}ms` }}
                  >
                    {item}
                  </span>
                  {index < scene.sequence.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-white/25" />}
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl text-xs font-bold leading-5 text-slate-400">
                <span className={tone.text}>MEMORY CUE · </span>{scene.cue}
              </div>
              <button
                type="button"
                onClick={() => onJump(scene.targetMode, scene.targetNode)}
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-950 transition hover:scale-[1.02]"
              >
                그래프에서 열기 <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="relative hidden min-h-[440px] overflow-hidden border-l border-white/10 lg:block">
          <div className="absolute left-1/2 top-1/2 h-[310px] w-[310px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
          <div className="visual-orbit-ring absolute left-1/2 top-1/2 h-[230px] w-[230px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/15" />
          <div className="absolute left-1/2 top-1/2 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/[0.03]" />

          <div key={`core-${sceneIndex}`} className="visual-core-pop absolute left-1/2 top-1/2 z-10 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-white/20 bg-slate-950/85 text-center shadow-[0_0_70px_rgba(139,92,246,0.22)] backdrop-blur">
            <Network className={`mb-2 h-6 w-6 ${tone.text}`} />
            <div className="text-[9px] font-black tracking-[0.18em] text-white/40">ACTIVE CORE</div>
            <div className="mt-1 max-w-24 text-sm font-black leading-4 text-white">{scene.accent}</div>
          </div>

          {scene.orbit.map((item, index) => (
            <div
              key={`${sceneIndex}-${item}`}
              className={`visual-brain-node absolute ${orbitPositions[index]} rounded-2xl border border-white/15 bg-slate-950/75 px-3 py-2.5 shadow-xl backdrop-blur`}
              style={{ animationDelay: `${index * 180}ms` }}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                <span className="text-[10px] font-black tracking-[0.12em] text-white/80">{item}</span>
              </div>
            </div>
          ))}

          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 520 440" preserveAspectRatio="none" aria-hidden="true">
            <line x1="260" y1="220" x2="92" y2="90" stroke="rgba(255,255,255,.13)" strokeWidth="1" strokeDasharray="5 7" />
            <line x1="260" y1="220" x2="435" y2="112" stroke="rgba(255,255,255,.13)" strokeWidth="1" strokeDasharray="5 7" />
            <line x1="260" y1="220" x2="88" y2="353" stroke="rgba(255,255,255,.13)" strokeWidth="1" strokeDasharray="5 7" />
            <line x1="260" y1="220" x2="438" y2="362" stroke="rgba(255,255,255,.13)" strokeWidth="1" strokeDasharray="5 7" />
          </svg>

          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/20 p-1.5 backdrop-blur">
            {memoryScenes.map((item, index) => (
              <button
                key={item.kicker}
                type="button"
                onClick={() => setSceneIndex(index)}
                className={`h-2.5 rounded-full transition-all ${index === sceneIndex ? `w-8 ${tone.dot}` : "w-2.5 bg-white/20 hover:bg-white/40"}`}
                aria-label={`Visual memory scene ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10 bg-black/10 px-5 py-3 sm:px-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPlaying((current) => !current)}
            className="flex shrink-0 items-center gap-1.5 text-[10px] font-black tracking-[0.12em] text-white/60 hover:text-white"
          >
            {playing ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {playing ? "PAUSE" : "PLAY"}
          </button>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            {playing && <div key={`progress-${sceneIndex}`} className={`visual-cinema-progress h-full rounded-full ${tone.dot}`} />}
          </div>
          <div className="shrink-0 text-[10px] font-black tabular-nums tracking-[0.12em] text-white/40">
            {String(sceneIndex + 1).padStart(2, "0")} / {String(memoryScenes.length).padStart(2, "0")}
          </div>
        </div>
      </div>
    </section>
  );
}

function GraphCanvas({
  data,
  selectedId,
  onSelect,
  focusEnabled,
  recallMode,
  revealedIds,
  onReveal,
  edgeRecallMode,
  revealedEdgeKeys,
  onRevealEdge,
}: {
  data: GraphData;
  selectedId: string;
  onSelect: (id: string) => void;
  focusEnabled: boolean;
  recallMode: boolean;
  revealedIds: Set<string>;
  onReveal: (id: string) => void;
  edgeRecallMode: boolean;
  revealedEdgeKeys: Set<string>;
  onRevealEdge: (key: string) => void;
}) {
  const nodeMap = useMemo(() => new Map(data.nodes.map((node) => [node.id, node])), [data.nodes]);
  const canvas = data.viewBox ?? { width: 980, height: 610, minWidth: 820 };
  const connectedIds = useMemo(() => {
    const ids = new Set<string>([selectedId]);
    for (const edge of data.edges) {
      if (edge.from === selectedId) ids.add(edge.to);
      if (edge.to === selectedId) ids.add(edge.from);
    }
    return ids;
  }, [data.edges, selectedId]);

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white [scrollbar-width:thin]">
      <svg
        viewBox={`0 0 ${canvas.width} ${canvas.height}`}
        style={{ minWidth: canvas.minWidth ?? 820 }}
        className="block h-auto w-full bg-[radial-gradient(circle_at_center,_#f8fafc_0,_#ffffff_68%)]"
        role="img"
        aria-label={`${data.title} knowledge graph`}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
          </marker>
        </defs>

        {data.zones?.map((zone) => {
          const zoneStyle =
            zone.kind === "research"
              ? { fill: "#f5f3ff", stroke: "#ddd6fe", text: "#7c3aed" }
              : zone.kind === "experience"
                ? { fill: "#ecfdf5", stroke: "#bbf7d0", text: "#059669" }
                : zone.kind === "faculty"
                  ? { fill: "#ecfeff", stroke: "#a5f3fc", text: "#0891b2" }
                  : { fill: "#fff7ed", stroke: "#fed7aa", text: "#ea580c" };
          return (
            <g key={zone.label}>
              <rect
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                rx="28"
                fill={zoneStyle.fill}
                fillOpacity="0.36"
                stroke={zoneStyle.stroke}
                strokeWidth="1.5"
                strokeDasharray="6 7"
              />
              <text
                x={zone.x + 18}
                y={zone.y + 25}
                fontSize="10"
                fontWeight="800"
                letterSpacing="1.2"
                fill={zoneStyle.text}
              >
                {zone.label}
              </text>
            </g>
          );
        })}

        {data.edges.map((edge, index) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const a = centerOf(from);
          const b = centerOf(to);
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const direct = edge.from === selectedId || edge.to === selectedId;
          const dimmed = focusEnabled && !direct;
          const key = edgeKey(edge);
          const relationRevealed = !edgeRecallMode || revealedEdgeKeys.has(key);
          const relationLabel = relationRevealed ? edge.label : "???";
          return (
            <g key={`${edge.from}-${edge.to}-${index}`} opacity={dimmed ? 0.18 : 1}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={direct && focusEnabled ? "#64748b" : "#cbd5e1"}
                strokeWidth={direct && focusEnabled ? 3 : 2}
                markerEnd="url(#arrow)"
              />
              {edge.label && (
                <g
                  role={edgeRecallMode ? "button" : undefined}
                  tabIndex={edgeRecallMode ? 0 : undefined}
                  aria-label={edgeRecallMode ? "관계 확인" : undefined}
                  onClick={(event) => {
                    if (!edgeRecallMode) return;
                    event.stopPropagation();
                    onRevealEdge(key);
                  }}
                  onKeyDown={(event) => {
                    if (!edgeRecallMode) return;
                    if (event.key === "Enter" || event.key === " ") onRevealEdge(key);
                  }}
                  className={edgeRecallMode ? "cursor-pointer outline-none" : undefined}
                >
                  <rect
                    x={midX - 48}
                    y={midY - 12}
                    width="96"
                    height="22"
                    rx="11"
                    fill={relationRevealed ? "#ffffff" : "#fff7ed"}
                    stroke={relationRevealed ? "#e2e8f0" : "#fdba74"}
                  />
                  <text x={midX} y={midY + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill={relationRevealed ? "#64748b" : "#c2410c"}>
                    {relationLabel}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {data.nodes.map((node) => {
          const width = node.width ?? 170;
          const selected = selectedId === node.id;
          const style = nodeStyle(node.kind, selected);
          const connected = connectedIds.has(node.id);
          const dimmed = focusEnabled && !connected;
          const revealed = !recallMode || selected || revealedIds.has(node.id);
          const lines = revealed
            ? splitNodeLabel(node.label, Math.max(13, Math.floor(width / 10)))
            : ["?"];
          return (
            <g
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={`${node.label} 보기`}
              onClick={() => {
                onReveal(node.id);
                onSelect(node.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  onReveal(node.id);
                  onSelect(node.id);
                }
              }}
              className="cursor-pointer outline-none"
              opacity={dimmed ? 0.22 : 1}
            >
              <rect
                x={node.x}
                y={node.y}
                width={width}
                height="76"
                rx="17"
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={selected ? 3 : 1.5}
              />
              <text
                x={node.x + width / 2}
                y={node.y + (lines.length === 1 ? 31 : 24)}
                textAnchor="middle"
                fontSize="12"
                fontWeight="800"
                fill={style.text}
              >
                {lines.map((line, lineIndex) => (
                  <tspan
                    key={`${node.id}-line-${lineIndex}`}
                    x={node.x + width / 2}
                    dy={lineIndex === 0 ? 0 : 15}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
              {node.subtitle && revealed && (
                <text x={node.x + width / 2} y={node.y + 63} textAnchor="middle" fontSize="9" fontWeight="650" fill={style.sub}>
                  {node.subtitle.length > 35 ? `${node.subtitle.slice(0, 34)}…` : node.subtitle}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function InterviewKnowledgeGraph() {
  const [mode, setMode] = useState<Mode>("research");
  const [focusEnabled, setFocusEnabled] = useState(true);
  const [recallMode, setRecallMode] = useState(false);
  const [edgeRecallMode, setEdgeRecallMode] = useState(false);
  const [pathEnabled, setPathEnabled] = useState(false);
  const [pathIndex, setPathIndex] = useState(0);
  const [showMobileMap, setShowMobileMap] = useState(false);
  const [expandedIntegrated, setExpandedIntegrated] = useState<string[]>([]);
  const rawData = graphs[mode];
  const [selectedByMode, setSelectedByMode] = useState<Record<Mode, string>>({
    research: "rag",
    faculty: "research-core",
    experience: "identity",
    pressure: "defense-core",
    integrated: "integrated-center",
  });
  const [revealedByMode, setRevealedByMode] = useState<Record<Mode, string[]>>({
    research: ["rag"],
    faculty: ["research-core"],
    experience: ["identity"],
    pressure: ["defense-core"],
    integrated: ["integrated-center"],
  });
  const [revealedEdgesByMode, setRevealedEdgesByMode] = useState<Record<Mode, string[]>>({
    research: [],
    faculty: [],
    experience: [],
    pressure: [],
    integrated: [],
  });

  const data = useMemo(() => {
    if (mode !== "integrated" || !rawData.expandable) return rawData;
    const childToParent = new Map<string, string>();
    for (const [parent, children] of Object.entries(rawData.expandable)) {
      for (const child of children) childToParent.set(child, parent);
    }
    const visibleNodes = rawData.nodes.filter((node) => {
      const parent = childToParent.get(node.id);
      return !parent || expandedIntegrated.includes(parent);
    });
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    return {
      ...rawData,
      nodes: visibleNodes,
      edges: rawData.edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)),
    };
  }, [expandedIntegrated, mode, rawData]);

  const selectedId = selectedByMode[mode];
  const selected = data.nodes.find((node) => node.id === selectedId) ?? data.nodes[0];
  const revealedIds = useMemo(() => new Set(revealedByMode[mode]), [mode, revealedByMode]);
  const revealedEdgeKeys = useMemo(
    () => new Set(revealedEdgesByMode[mode]),
    [mode, revealedEdgesByMode]
  );
  const currentPath = rawData.path ?? [];
  const selectedStage = nodeStageLinks[mode][selected?.id ?? ""];
  const interviewHref = selectedStage
    ? `/?section=research&stage=${selectedStage}`
    : "/";
  const audioHref = selectedStage
    ? `/audio?track=${encodeURIComponent(`presentation:research-${selectedStage}:ko`)}`
    : "/audio";

  const relatedNodes = useMemo(() => {
    return data.edges
      .filter((edge) => edge.from === selectedId || edge.to === selectedId)
      .map((edge) => {
        const otherId = edge.from === selectedId ? edge.to : edge.from;
        return {
          node: data.nodes.find((node) => node.id === otherId),
          relation: edge.label ?? "related",
          edgeKey: edgeKey(edge),
          outgoing: edge.from === selectedId,
        };
      })
      .filter(
        (item): item is { node: GraphNode; relation: string; edgeKey: string; outgoing: boolean } =>
          Boolean(item.node)
      );
  }, [data.edges, data.nodes, selectedId]);

  const revealNode = (id: string) => {
    setRevealedByMode((current) => ({
      ...current,
      [mode]: current[mode].includes(id) ? current[mode] : [...current[mode], id],
    }));
  };

  const revealEdge = (key: string) => {
    setRevealedEdgesByMode((current) => ({
      ...current,
      [mode]: current[mode].includes(key) ? current[mode] : [...current[mode], key],
    }));
  };

  const selectNode = (id: string) => {
    revealNode(id);
    setSelectedByMode((current) => ({ ...current, [mode]: id }));
  };

  const resetRecall = () => {
    setRevealedByMode((current) => ({ ...current, [mode]: [selectedId] }));
    setRevealedEdgesByMode((current) => ({ ...current, [mode]: [] }));
  };

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setPathEnabled(false);
    setPathIndex(0);
    setShowMobileMap(false);
  };

  const startOrStopPath = () => {
    if (pathEnabled) {
      setPathEnabled(false);
      return;
    }
    if (!currentPath.length) return;
    setPathEnabled(true);
    setPathIndex(0);
    selectNode(currentPath[0]);
  };

  const movePath = (direction: 1 | -1) => {
    if (!currentPath.length) return;
    const nextIndex = Math.min(currentPath.length - 1, Math.max(0, pathIndex + direction));
    setPathIndex(nextIndex);
    selectNode(currentPath[nextIndex]);
  };

  const expandableChildren = rawData.expandable?.[selectedId] ?? [];
  const integratedExpanded = expandedIntegrated.includes(selectedId);
  const toggleIntegratedNode = () => {
    if (!expandableChildren.length) return;
    setExpandedIntegrated((current) =>
      current.includes(selectedId)
        ? current.filter((id) => id !== selectedId)
        : [...current, selectedId]
    );
  };

  const jumpFromCinema = (targetMode: Mode, targetNode: string) => {
    setMode(targetMode);
    setPathEnabled(false);
    setPathIndex(0);
    setShowMobileMap(false);
    setSelectedByMode((current) => ({ ...current, [targetMode]: targetNode }));
    setRevealedByMode((current) => ({
      ...current,
      [targetMode]: current[targetMode].includes(targetNode)
        ? current[targetMode]
        : [...current[targetMode], targetNode],
    }));
    window.setTimeout(() => {
      document.getElementById("visual-knowledge-map")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f9fc] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Network className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-black tracking-tight">KAIST BTM 면접 비주얼</div>
              <div className="truncate text-xs font-bold text-slate-400">Knowledge Graph · Visual Recall</div>
            </div>
          </div>
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> 면접 카드
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        <MemoryCinema onJump={jumpFromCinema} />

        <div id="visual-knowledge-map" className="scroll-mt-24" />
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {modeMeta.map((item) => {
              const Icon = item.icon;
              const active = item.id === mode;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeMode(item.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition ${active ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
                >
                  <Icon className="h-4 w-4" /> {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startOrStopPath}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition ${
                pathEnabled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              {pathEnabled ? <Square className="h-3 w-3" /> : <Play className="h-3.5 w-3.5" />}
              Path
            </button>
            <button
              type="button"
              onClick={() => setFocusEnabled((current) => !current)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition ${
                focusEnabled
                  ? "border-violet-200 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              <Network className="h-3.5 w-3.5" /> 연결 강조
            </button>
            <button
              type="button"
              onClick={() => setRecallMode((current) => !current)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition ${
                recallMode
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              {recallMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              Node Recall
            </button>
            <button
              type="button"
              onClick={() => setEdgeRecallMode((current) => !current)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition ${
                edgeRecallMode
                  ? "border-orange-200 bg-orange-50 text-orange-700"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              <Route className="h-3.5 w-3.5" /> Edge Recall
            </button>
            {(recallMode || edgeRecallMode) && (
              <button
                type="button"
                onClick={resetRecall}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-500"
                aria-label="Recall 다시 시작"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <section className="mb-4">
          <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">{rawData.title}</h1>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{rawData.description}</p>
        </section>

        {pathEnabled && currentPath.length > 0 && (
          <section className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-black text-emerald-700">
                  <Route className="h-4 w-4" /> Path {pathIndex + 1} / {currentPath.length}
                </div>
                <div className="mt-1 truncate text-sm font-black text-slate-800">
                  {rawData.nodes.find((node) => node.id === currentPath[pathIndex])?.label}
                </div>
                <div className="mt-0.5 text-xs font-semibold text-slate-500">
                  이 노드의 의미와 앞뒤 연결을 먼저 말한 뒤 다음으로 이동하세요.
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => movePath(-1)}
                  disabled={pathIndex === 0}
                  className="rounded-xl border border-emerald-200 bg-white p-2 text-emerald-700 disabled:opacity-30"
                  aria-label="이전 Path 노드"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => movePath(1)}
                  disabled={pathIndex === currentPath.length - 1}
                  className="rounded-xl bg-emerald-600 p-2 text-white disabled:opacity-30"
                  aria-label="다음 Path 노드"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        )}

        {(recallMode || edgeRecallMode) && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">
            {recallMode && "노드 이름은 위치와 연결을 보고 먼저 떠올린 뒤 눌러 확인합니다. "}
            {edgeRecallMode && "??? 관계어는 두 노드가 왜 연결되는지 먼저 말한 뒤 눌러 확인합니다."}
          </div>
        )}

        <section className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 lg:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Mobile focus</div>
              <div className="mt-1 text-lg font-black text-slate-900">{selected.label}</div>
              {selected.cue && <div className="mt-1 text-xs font-bold leading-5 text-violet-700">{selected.cue}</div>}
            </div>
            <button
              type="button"
              onClick={() => setShowMobileMap((current) => !current)}
              className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600"
            >
              {showMobileMap ? "맵 닫기" : "전체 맵"}
            </button>
          </div>
          {relatedNodes.length > 0 && (
            <div className="mt-4 space-y-2">
              {relatedNodes.map(({ node, relation, edgeKey: relationKey, outgoing }) => (
                <div
                  key={`mobile-${selected.id}-${node.id}`}
                  className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2"
                >
                  <button
                    type="button"
                    onClick={() => selectNode(node.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-slate-400">
                      {outgoing ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-800">{node.label}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => revealEdge(relationKey)}
                    disabled={!edgeRecallMode || revealedEdgeKeys.has(relationKey)}
                    className={`shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-black ${
                      edgeRecallMode && !revealedEdgeKeys.has(relationKey)
                        ? "bg-orange-100 text-orange-700"
                        : "bg-white text-slate-400"
                    }`}
                  >
                    {edgeRecallMode && !revealedEdgeKeys.has(relationKey) ? "???" : relation}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className={`${showMobileMap ? "block" : "hidden"} min-w-0 max-w-full lg:block`}>
            <GraphCanvas
              data={data}
              selectedId={selectedId}
              onSelect={selectNode}
              focusEnabled={focusEnabled}
              recallMode={recallMode}
              revealedIds={revealedIds}
              onReveal={revealNode}
              edgeRecallMode={edgeRecallMode}
              revealedEdgeKeys={revealedEdgeKeys}
              onRevealEdge={revealEdge}
            />
          </div>

          <aside className="min-w-0 w-full max-w-full rounded-3xl border border-slate-200 bg-white p-5 lg:sticky lg:top-24">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">
                    {selected.kind}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Selected</span>
                </div>
                <h2 className="mt-2 text-xl font-black leading-7 tracking-tight text-slate-900">{selected.label}</h2>
                {selected.subtitle && <div className="mt-1 text-xs font-bold text-slate-400">{selected.subtitle}</div>}
              </div>
              {selected.url && (
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800"
                >
                  논문 <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <p className="mt-4 break-words text-sm font-semibold leading-7 text-slate-700">{selected.summary}</p>

            {selected.cue && (
              <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-500">Recall cue</div>
                <div className="mt-1 break-words text-sm font-black leading-6 text-violet-900">{selected.cue}</div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href={interviewHref}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-black text-white"
              >
                면접카드 <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={audioHref}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-700"
              >
                <Headphones className="h-3.5 w-3.5" /> Audio
              </Link>
            </div>

            {mode === "integrated" && expandableChildren.length > 0 && (
              <button
                type="button"
                onClick={toggleIntegratedNode}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-xs font-black text-cyan-800"
              >
                <Layers3 className="h-4 w-4" />
                {integratedExpanded ? "하위 노드 접기" : `하위 노드 ${expandableChildren.length}개 펼치기`}
              </button>
            )}

            {selected.bullets && selected.bullets.length > 0 && (
              <div className="mt-4 space-y-2">
                {selected.bullets.map((bullet) => (
                  <div key={bullet} className="break-words rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold leading-5 text-slate-600">
                    {bullet}
                  </div>
                ))}
              </div>
            )}

            {relatedNodes.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">직접 연결</div>
                <div className="mt-2 space-y-2">
                  {relatedNodes.map(({ node, relation, edgeKey: relationKey }) => (
                    <div
                      key={`${selected.id}-${node.id}`}
                      className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => selectNode(node.id)}
                        className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-xs font-black text-slate-700 hover:bg-violet-50"
                      >
                        <span className="block truncate">{node.label}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => revealEdge(relationKey)}
                        disabled={!edgeRecallMode || revealedEdgeKeys.has(relationKey)}
                        className={`max-w-[45%] shrink-0 truncate rounded-lg px-2 py-1.5 text-[10px] font-black ${
                          edgeRecallMode && !revealedEdgeKeys.has(relationKey)
                            ? "bg-orange-100 text-orange-700"
                            : "bg-slate-50 text-slate-400"
                        }`}
                      >
                        {edgeRecallMode && !revealedEdgeKeys.has(relationKey) ? "???" : relation}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 text-xs font-semibold text-slate-400">
          <span>Path로 흐름을 익히고, Node/Edge Recall로 개념과 관계를 따로 회상할 수 있습니다.</span>
          <span className="hidden items-center gap-1 sm:flex"><User className="h-3.5 w-3.5" /> Active Recall</span>
        </div>
      </div>
    </main>
  );
}
