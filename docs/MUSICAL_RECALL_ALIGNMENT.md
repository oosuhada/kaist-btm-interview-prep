# Musical Recall word-level alignment

`Musical Recall`의 가사 싱크는 생성 모델이 반환한 Lyria section timestamp를 최종 기준으로 사용하지 않습니다. 실제 배포 MP3를 다시 분석해 만든 독립 alignment manifest를 source of truth로 사용합니다.

## 파일 위치

```text
public/audio/musical-recall/alignment.json
```

이 파일은 다음 기능이 공동으로 읽도록 설계했습니다.

- `/audio` Musical Recall synced lyrics
- `/visual` kinetic lyrics / audio-reactive visualization
- 브레인맵·키워드 애니메이션의 향후 오디오 동기화
- 향후 Remotion MP4 렌더링

## 생성 방식

1. `public/audio/musical-recall/manifest.json`에서 곡 ID, 언어, canonical lyrics 순서만 읽습니다.
2. timestamp는 Lyria metadata에서 가져오지 않습니다.
3. 실제 `public/audio/musical-recall/*.mp3`를 Whisper alignment engine으로 다시 듣고 word timestamp를 생성합니다. Apple Silicon에서는 MLX를 우선 사용하고, 다른 환경에서는 faster-whisper로 fallback할 수 있습니다.
4. canonical lyrics token과 실제 ASR word를 순서를 보존하는 fuzzy alignment로 매칭합니다.
5. 정확히 매칭된 단어는 실제 MP3에서 얻은 start/end timestamp를 사용합니다.
6. ASR이 놓친 일부 canonical token은 앞뒤의 실제 audio timestamp anchor 사이에서만 보간하며 `matched: false`로 명시합니다.
7. 곡별 `matchRate`, `meanMatchedWordConfidence`, `meanLexicalSimilarity`, `alignmentConfidence`를 기록합니다.
8. 1차 ASR의 `matchRate`가 낮은 트랙은 `openai-whisper`의 cross-attention DTW forced alignment로 실제 MP3 전체를 30초 겹침 window로 검색합니다. 이 단계도 Lyria timing을 사용하지 않습니다.
9. 반복되는 후렴/문장은 cue 순서를 동시에 최적화해 앞쪽 동일 문장에 잘못 붙지 않도록 합니다. forced 결과가 기존 실제-ASR보다 낫지 않으면 기존 값을 유지합니다.
10. 마지막으로 모든 cue/word timestamp가 실제 MP3 duration 내부인지 검증합니다. 실제 음원에 없는 trailing canonical token은 duration 경계의 `matched: false` token으로 남깁니다.
11. canonical interview question을 기준으로 모든 aligned word에 `role: "question" | "answer"`를 저장합니다. 첫 lyric cue 안에 질문과 답변 첫 문장이 함께 들어간 곡도 word 단위로 역할이 갈리므로 `/audio`, `/visual`, Remotion이 동일한 Q/A 경계를 재사용할 수 있습니다.

## 사용 모델 / API

- **1차 alignment engine:** `mlx-whisper` + `mlx-community/whisper-small-mlx`, word timestamps 활성화, 실제 Musical Recall MP3 입력
- **2차 forced alignment:** 이미 로컬에 있는 `openai-whisper` `tiny` / `tiny.en`의 cross-attention + DTW로 canonical lyrics를 실제 MP3에 직접 정렬합니다. ASR이 문장을 다른 문장으로 바꿔버리는 singing failure를 보완합니다.
- **optional quality retry:** 필요하면 `faster-whisper medium` 등 더 강한 모델로 실제 MP3를 다시 분석할 수 있습니다. 실제 테스트에서 `application-opening-60:ko`는 small ASR 36.9%에서 medium 77.9%로 개선됐지만 CPU 비용이 커 최종 기본 파이프라인은 forced alignment repair를 사용합니다.
- canonical lyrics는 ASR의 `initial_prompt`와 사후 forced matching 텍스트로 사용합니다.
- **Google Cloud Speech-to-Text probe:** `flai-oosuhada-20260506` 프로젝트에서 Speech-to-Text API를 활성화하고 `latest_long`으로 실제 MP3 샘플을 테스트했습니다. 음악 반주가 강한 샘플에서 result timing boundary는 반환됐지만 lexical alternative가 비어 최종 aligner로 채택하지 않았습니다.
- Chirp 3도 검토했으며 word-level timestamp 기능은 지원하지만 리전/feature 조합 제약이 있고, 이번 Musical Recall mixed music 샘플에서는 로컬 Whisper 기반 실제 오디오 정렬이 더 안정적이었습니다.

## 재생성 명령

프로젝트 루트에서:

Apple Silicon 권장:

```bash
python3 -m venv .alignment-venv
source .alignment-venv/bin/activate
pip install mlx-whisper
python3 tools/build_musical_recall_alignment.py --engine mlx-whisper --workers 1
python3 tools/repair_musical_recall_forced_alignment.py
```

CPU/fallback:

```bash
pip install faster-whisper
python3 tools/build_musical_recall_alignment.py --engine faster-whisper --model small --workers 1
python3 tools/repair_musical_recall_forced_alignment.py
```

이미 성공한 곡을 재사용하면서 누락분만 다시 처리하려면:

```bash
python3 tools/build_musical_recall_alignment.py --workers 1 --resume
```

예를 들어 80% 미만 트랙만 더 강한 모델로 quality retry하려면:

```bash
python3 tools/build_musical_recall_alignment.py \
  --engine faster-whisper \
  --model medium \
  --workers 1 \
  --resume \
  --resume-min-match-rate 0.8
```

특정 질문 또는 언어만 검증할 수도 있습니다.

```bash
python3 tools/build_musical_recall_alignment.py --track application-q46
python3 tools/build_musical_recall_alignment.py --language ko
```

필요 Python dependency는 실행 엔진에 따라 하나를 선택합니다.

```bash
python3 -m pip install mlx-whisper
# 또는
python3 -m pip install faster-whisper
```

## 현재 생성 결과

- 대상: **44곡** (22개 질문 × 한국어/영어)
- 최종 manifest 생성 성공: **44곡 / 44곡**
- 실패: **0곡**
- 1차 평균 token match rate: **86.4%** (median **92.7%**)
- forced repair 적용: **8곡 / 17 cues**
- forced repair 후 평균 match/coverage 지표: **90.8%** (median **92.7%**)
- forced 결과가 기존 실제-ASR보다 낫지 않아 기존 값을 유지한 저신뢰 트랙도 있습니다. 따라서 UI/후속 렌더러는 `matchRate`와 `alignmentConfidence`를 함께 참고할 수 있습니다.
- 최종 validation: **44곡 모두 cue/word timestamp가 실제 MP3 duration 범위 안에 있음**
- machine-readable 집계는 `alignment.json`의 `summary`와 `failures`를 기준으로 합니다.

## manifest 핵심 구조

```json
{
  "sourceOfTruth": "actual published Musical Recall MP3 audio",
  "tracks": [
    {
      "trackId": "application-q46",
      "language": "ko",
      "src": "/audio/musical-recall/application-q46-ko.mp3",
      "duration": 81.234,
      "alignmentEngine": "mlx-whisper/mlx-community/whisper-small-mlx",
      "words": [
        { "text": "프로젝트에서", "start": 1.24, "end": 2.58, "role": "question", "matched": true }
      ],
      "cues": [
        {
          "text": "...",
          "start": 0.0,
          "end": 5.46,
          "words": []
        }
      ],
      "matchRate": 0.92,
      "alignmentConfidence": 0.77
    }
  ]
}
```

영상/HTML 컴포넌트에 timestamp를 별도로 하드코딩하지 말고 이 manifest를 읽어야 합니다.

현재 코드에서 `/audio`와 `/visual`은 `lib/musical-recall-alignment.ts`를 통해 같은 manifest를 읽습니다. Remotion 렌더러도 이 파일을 직접 읽거나 같은 타입/loader를 재사용하는 방향을 권장합니다.
