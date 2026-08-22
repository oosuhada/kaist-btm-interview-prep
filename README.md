# KAIST BTM Interview Prep

**면접을 며칠 앞두고, 텍스트 위주의 준비 자료를 `말하고 · 듣고 · 보고 · 회상하는` 인터랙티브 학습 도구로 바꾼 개인 프로젝트입니다.**

**A personal project built just days before an actual graduate-school interview, turning text-heavy preparation into an interactive system for speaking, listening, visual recall, and active retrieval.**

### 🔗 Live

**https://kaist.oosu.dev**

> KAIST Business and Technology Management(BTM) 대학원 면접 준비를 위해 실제로 사용하고 있는 도구입니다. 범용 면접 서비스의 데모가 아니라, 제 지원서·경력·연구계획을 짧은 시간 안에 반복해서 꺼내 말할 수 있도록 설계했습니다.
>
> This is the tool I actually built and used to prepare for a KAIST BTM graduate-admissions interview. It is not a generic interview-app demo; it was designed around a concrete constraint: being able to retrieve my own application, career, and research story quickly under interview pressure.

---

## Why I Built It / 만든 이유

Before my KAIST graduate-school interview, I had answers organized in Notion — but reading them over and over didn't help. I could recognize the material, yet the words wouldn't come out when asked aloud. I turned those notes into spoken, visual, and musical recall drills modeled after the musicals I already listen to every day.

카이스트 대학원 면접 일정이 급하게 잡히고 나서, 예상 질문과 답변은 Notion에 정리해두고 읽어봤지만 머리에 남지 않았습니다. 눈으로 보면 아는 내용인데 질문을 받으면 입에서 나오지 않는 게 문제였습니다. 평소 매일 듣던 뮤지컬 넘버처럼, 말하고 듣고 보고 반복하는 회상 도구로 바꿔서 만들었습니다.

### Recall Design / 회상 설계

- Interview cards progressively hide answer details to force active recall.
- Audio Recall supports continuous question → answer listening and last-minute priority filtering.
- Visual Recall maps relationships among experience, research design, and faculty fit.
- Korean and English share the same question structure instead of becoming separate memorization sets.

## 제품 화면 / Product walkthrough

### 1. Application Defense — 지원서에서 바로 말하기

지원동기, 경력, 학점, 프로젝트, 활동을 하나의 긴 예상질문 목록으로 두지 않고 **Opening + Story Cluster**로 묶었습니다. 답변 공개 정도를 조절해 처음에는 충분한 힌트를 보고, 익숙해질수록 키워드만 남기는 방식으로 연습합니다.

Instead of treating dozens of application questions as one flat list, the app groups them into an **Opening + Story Cluster** structure. Progressive masking lets the same card move from guided rehearsal to near-blank recall.

![Application Defense interview cards](docs/screenshots/01-interview-cards.png)

### 2. Audio Recall — 모든 트랙을 듣는 대신, 지금 필요한 것만

질문과 답변을 미리 생성한 오디오 트랙으로 연결해 이동 중에도 연습할 수 있게 했습니다. 특히 트랙이 많아진 뒤에는 **우선순위 필터**를 추가했습니다.

`전체 → 주요 → 핵심 → 면접 직전`으로 슬라이더를 올릴수록 낮은 우선순위의 트랙이 사라집니다. 면접장으로 이동하는 순간에는 꼭 다시 들어야 하는 질문만 남길 수 있습니다.

Audio tracks combine each question and answer for continuous rehearsal. Once the playlist became large, I added a **priority filter** rather than another category menu.

Moving the slider from `All → Major → Core → Right before interview` progressively removes lower-priority tracks, making the same playlist useful both during broad preparation and in the final minutes before an interview.

![Audio Recall and priority filter](docs/screenshots/02-audio-recall.png)

### 3. Visual Recall — 하나의 내용을 세 가지 방식으로 회상하기

연구주제는 문장을 그대로 외우는 것보다 `문제 → 연구질문 → 문헌공백 → 방법론 → 기여`, 그리고 `경력 → 연구 관심 → 교수 적합성`의 연결을 기억하는 것이 더 중요하다고 판단했습니다. 최신 Visual Recall은 같은 면접 지식을 학습 상황에 따라 세 가지 모드로 보여줍니다.

- **Map** — 전체 지식 그래프에서 노드와 관계를 탐색하고 Path / Node / Edge Recall로 연결을 복구합니다.
- **Guided Recall** — 질문별 핵심 단서를 순서대로 따라가며 답변 구조를 단계적으로 재구성합니다.
- **Musical Recall** — 사전 생성된 KR/EN 오디오와 동기화된 motion lyrics로 리듬과 문장 흐름을 함께 기억합니다.

For research preparation, I found relationships more important than memorizing exact sentences: `problem → research question → literature gap → method → contribution`, and `experience → research interest → faculty fit`. The upgraded Visual Recall surface now provides three complementary modes:

- **Map** for exploring the full knowledge graph and rebuilding paths, nodes, and edges.
- **Guided Recall** for reconstructing an answer step by step from ordered cues.
- **Musical Recall** for pairing pre-generated KR/EN audio with synchronized motion lyrics.

![Visual Recall modes](docs/screenshots/03-visual-recall.png)

### 4. Musical Recall — 듣기에서 동기화된 회상으로

기존 Audio Recall이 이동 중 반복 청취에 초점을 맞췄다면, Musical Recall은 재생 중인 문장을 화면의 리듬과 움직임으로 함께 따라가게 합니다. 트랙을 선택하면 질문, 현재 문장, 전체 진행률이 하나의 집중 화면에 표시되고 한국어와 영어 버전을 즉시 전환할 수 있습니다.

Where Audio Recall is optimized for hands-free repetition, Musical Recall turns playback into a synchronized visual exercise. Selecting a track opens a focused motion-lyrics view with the question, current phrase, full progress, and immediate KR/EN switching.

![Musical Recall motion lyrics](docs/screenshots/07-musical-recall.png)

### 5. Mobile-first rehearsal

실제로 가장 자주 연습하는 환경이 노트북 앞이 아니라 이동 중의 iPhone이었기 때문에, 면접카드·Audio·Visual 모두 작은 화면에서 바로 사용할 수 있도록 반복해서 모바일 UI를 다듬었습니다. 아래 화면은 별도의 포트폴리오용 목업이 아니라 **실제 배포본을 iPhone 크기로 실행한 화면**입니다.

Because much of the actual rehearsal happens on an iPhone while moving rather than at a desk, the card, audio, and visual interfaces were repeatedly adjusted for small-screen use. These are **the deployed product at an iPhone viewport**, not separate portfolio mockups.

<table>
  <tr>
    <td align="center"><strong>Interview Cards</strong><br/><sub>질문 → 회상 → 키워드 → 답변</sub></td>
    <td align="center"><strong>Audio Recall</strong><br/><sub>이동 중 연속 재생</sub></td>
    <td align="center"><strong>Guided Recall</strong><br/><sub>단서를 따라 답변 구조 복구</sub></td>
  </tr>
  <tr>
    <td width="33%"><img src="docs/screenshots/04-mobile-home.png" alt="KAIST BTM interview cards on mobile" /></td>
    <td width="33%"><img src="docs/screenshots/05-mobile-audio.png" alt="KAIST BTM Audio Recall on mobile" /></td>
    <td width="33%"><img src="docs/screenshots/06-mobile-visual.png" alt="KAIST BTM Visual Recall on mobile" /></td>
  </tr>
</table>

세 화면을 따로 만든 이유도 같습니다. **앉아 있을 때는 면접카드로 직접 말하고, 이동할 때는 Audio로 반복하고, 연구·경력·논문의 연결이 흐려질 때는 Visual로 구조를 다시 봅니다.** 하나의 자료를 세 번 복제한 것이 아니라, 상황에 따라 다른 회상 경로를 쓰도록 설계했습니다.

The three surfaces are intentionally different. **Cards are for speaking, Audio is for repetition while moving, and Visual is for rebuilding relationships when the structure becomes fuzzy.** They are not three copies of the same material; they are three retrieval paths for different rehearsal contexts.

---

## 단순한 예상질문 앱보다 중요했던 것 / Product decisions that mattered

### 1. 사실을 만들어내지 않기 / Fact integrity

면접 답변은 그럴듯한 문장보다 **사실관계가 맞는 것**이 더 중요했습니다. 그래서 지원서, 기존 기록, 직접 회상에서 확인된 내용과 아직 확인하지 못한 내용을 분리하고, 사실이 복원되지 않은 질문은 `partial / recover` 상태로 남기는 방식으로 작업했습니다.

For interview preparation, a polished but invented story is worse than an incomplete answer. The workflow therefore distinguishes verified application/history facts from unresolved details; questions stay partial until the underlying fact is recovered.

### 2. 암기량을 늘리지 않고 압축하기 / Compression over accumulation

질문 수가 늘어날 때마다 새로운 스크립트를 외우는 대신, 같은 경험을 여러 질문에서 재사용할 수 있도록 Story Cluster와 공통 cue를 만들었습니다. Audio의 우선순위 필터도 같은 원칙에서 나왔습니다.

Instead of memorizing a new script for every new question, the system reuses a smaller set of stories and cues across multiple prompts. The audio priority filter follows the same principle: reduce what must be actively rehearsed as the interview approaches.

### 3. 표기와 발음을 분리하기 / Separate written labels from TTS pronunciation

`KAIST BTM`, 사람 이름, 브랜드명처럼 TTS가 자주 틀리는 표현은 화면 표기와 음성 입력을 분리했습니다. 사용자가 보는 텍스트는 원래 표기를 유지하고, 오디오 생성 단계에서만 별도의 발음 사전을 적용합니다.

Terms such as `KAIST BTM`, personal names, and brand names are stored separately from their TTS pronunciation. The UI keeps the intended written form while the audio-generation pipeline applies a pronunciation dictionary only at synthesis time.

### 4. 공개 가능한 형태로 분리하기 / Privacy-aware public release

실제 프로젝트는 개인 지원서, 추천서, 기기 기록 등을 참고해 만들어졌지만 이 공개 저장소에는 원본 개인 문서를 포함하지 않습니다. 웹사이트에 표시하는 데 필요한 **sanitized content snapshot**과 실행 자산만 별도로 묶었습니다.

The private working project used application documents, recommendation material, and personal records as evidence. Those raw sources are deliberately excluded from this public repository; only a **sanitized content snapshot** and the assets required to run the product are bundled here.

---

## 구현 / Implementation

### Stack

- **Next.js 16** App Router
- **React 19 + TypeScript**
- **Tailwind CSS**
- Pre-generated MP3 assets for continuous audio practice
- Sanitized bundled interview-content snapshot for self-contained deployment

### Main product surfaces

| Surface | What it does |
| --- | --- |
| `Application Defense` | Opening, motivation, career, GPA, activities, project and personal-fit recall |
| `Research Defense` | Research question, literature gap, methodology, contribution, feasibility and faculty-fit defense |
| `Audio Recall` | Continuous KR/EN Q&A playback, shuffle/repeat and priority-based track reduction |
| `Visual Recall · Map` | Spatial knowledge graph with Path, Node and Edge Recall |
| `Visual Recall · Guided` | Step-by-step answer reconstruction from ordered visual cues |
| `Visual Recall · Musical` | KR/EN synchronized audio, motion lyrics and track progress |
| `Difficulty masking` | Progressively removes visible answer information as recall improves |

### Data layout

- `data/interview/content.json` — sanitized snapshot of content rendered by the app
- `public/audio/interview/` — per-card question/answer audio assets
- `public/audio/tracks/` — continuous-playback tracks and manifest
- `public/audio/musical-recall/` — bilingual Musical Recall tracks and synchronization manifest
- `docs/screenshots/` — portfolio screenshots used in this README

The bundled snapshot is the production default, so a fresh clone does not depend on my private local folders. For private development only, `INTERVIEW_CONTENT_DIR` can override the bundled source.

---

## AI를 어떻게 사용했나 / How AI was used

이 프로젝트는 짧은 시간 안에 실제 문제를 해결하기 위해 **AI-assisted development**를 적극적으로 사용했습니다. 하지만 제품 방향, 어떤 정보를 복원해야 하는지, 무엇을 외우지 않아야 하는지, 우선순위를 어떻게 줄일지, 모바일에서 어떤 UI가 불편한지 같은 판단은 실제 면접 준비 과정에서 계속 수정했습니다.

저에게 이 프로젝트의 포인트는 “AI로 코드를 만들었다”가 아니라, **개인적인 문제를 제품 요구사항으로 바꾸고 → 빠르게 구현하고 → 실제 사용하면서 불편을 발견하고 → 다시 설계한 과정**에 있습니다.

I used **AI-assisted development** aggressively because the project had a real deadline. But the product direction came from actual use: deciding which facts needed recovery, which answers should not be invented, how aggressively to reduce rehearsal scope, where TTS pronunciation failed, and what broke on an iPhone.

For me, the portfolio value is not simply that AI helped generate code. It is the loop of **turning a personal constraint into product requirements → shipping quickly → using the product myself → observing friction → redesigning it.**

---

## Run locally

Node.js 20 or newer is recommended.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

Production build:

```bash
npm ci
npm run lint
npm run build
npm start
```

Set `PORT` to choose a production port, for example `PORT=3010 npm start`.

---

## Privacy

Original application PDFs, recommendation letters, device histories, personal logs, credentials, and private source documents are deliberately excluded. This repository contains only the sanitized interview-preparation content exposed by the application and the assets needed to run it.

## License

[MIT](LICENSE)

## Topics

[`active-recall`](https://github.com/topics/active-recall) · [`ai-assisted-development`](https://github.com/topics/ai-assisted-development) · [`interview-prep`](https://github.com/topics/interview-prep) · [`kaist`](https://github.com/topics/kaist) · [`learning-tools`](https://github.com/topics/learning-tools) · [`nextjs`](https://github.com/topics/nextjs) · [`typescript`](https://github.com/topics/typescript)
