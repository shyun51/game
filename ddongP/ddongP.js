/* =========================================================================
 * 텍스트 피하기 게임 (Canvas)
 * - 아이디어 2: 단계형 "현실 난이도 상승" + 휴식 페이즈
 * - 이 파일은 "로직은 그대로" 유지하고, 주석을 상세히 추가한 버전입니다.
 *
 * 핵심 개념
 *  1) stages[]        : 각 스테이지의 난이도/문구/시간/스폰 파라미터
 *  2) phasePlan[]     : 전체 진행 타임라인 (D1→Rest→D2→Rest→D3→Rest→D4)
 *  3) startPhase()    : 페이즈 시작 (stage/rest 모드 진입)
 *  4) update()/render(): 매 프레임 게임 상태 갱신/렌더
 *  5) 난이도 스케일링 : 시간/스테이지에 따른 낙하속도, 스폰 간격, 수평 드리프트 가중
 *
 * 커스터마이즈 포인트
 *  - 속도: baseFallSpeed, speedMul
 *  - 스폰: spawnIntervalMinMax, spawnMul, maxConcurrent
 *  - 시간: durationSec (stages 기본), phasePlan의 duration(페이즈별 우선)
 *  - 문구: stage.words
 * ========================================================================= */

/* -----------------------------------------
 * 1) 스테이지(난이도) 데이터
 * -----------------------------------------
 * durationSec           : 기본 스테이지 시간(초). 페이즈에서 duration으로 덮어쓸 수 있음.
 * baseFallSpeed         : 텍스트 기본 낙하 속도(px/s)
 * spawnIntervalMinMax   : 텍스트 생성 간격 범위(ms) - 실제는 스케일러에 의해 동적 단축
 * maxConcurrent         : 동시에 화면에 살아있을 수 있는 텍스트 최대 수 (스폰 상한)
 * speedMul / spawnMul   : 스테이지별 추가 배수(미세 튜닝)
 */
const stages = [
  {
    id: 1,
    name: "1단계 · 급식편", //=> 급식편
    bodyClass: "stage1",
    durationSec: 10,                 // 기본 25s
    baseFallSpeed: 200,               // 느림
    spawnIntervalMinMax: [700, 1100], //700 1100
    maxConcurrent: 5,                // 동시 5개까지
    speedMul: 1.0,
    spawnMul: 1.0,
    words: [ //연근
      "가지 무침","양념 버섯 무침","호박 무침","채식의 날","오이 무침",
      "시래기 국","버섯 탕수육","생선까스","추어탕","가지 볶음","종합 야채 주스",
      "버섯 볶음","고추 참채 덮밥","콩가루배추국"
    ],
  },
  {
    id: 2,
    name: "2단계 · 수업편", //=> 수업편
    bodyClass: "stage2",
    durationSec: 10,
    baseFallSpeed: 95,               // 중간
    spawnIntervalMinMax: [600, 950],
    maxConcurrent: 7,
    speedMul: 1.05,
    spawnMul: 1.05,
    words: [
      "너 발표야","오늘 수행평가래","오늘까지 숙제래","너 숙제 했냐?",
      "오늘 너 발표 순서야","칠판 나와서 해봐","지각이야!","교무실로 와",
      "시험 범위 바뀌었대","이번 시험 어렵대","고등학생 맞아?","이런거도 몰라?",
      "이정도는 알지?","오늘 체육 교실","얘들아 여기까지만 하자"
    ],
  },
  {
    id: 3,
    name: "3단계 · 연애편", //=> 연애편
    bodyClass: "stage3",
    durationSec: 25,
    baseFallSpeed: 125,              // 빠름
    spawnIntervalMinMax: [520, 880],
    maxConcurrent: 9,
    speedMul: 1.1,
    spawnMul: 1.1,
    words: [
      "나 할 말 있어","나 요즘 살찐 거 같아","뭐가 더 잘 어울려?","그럴 거면 걔랑 만나","왜 내 편 안 들어줘?",
      "됐어, 아무 일도 아냐","나 달라진 거 없어?","나 화 안 났어","오늘 무슨 날인 지 알아?","너랑 말 할 기분 아니야",
      "너가 뭘 잘못한 지 모르겠어?","난 기억 안 나는데?","아무거나","응 재밌게 놀아","나 집에 갈래","미안할 짓을 왜 해?",
      "나 물어볼 게 있는데","넌 항상 이런식이야","공감을 좀 해줘","내가 나쁜놈이지"
    ],
  },
  {
    id: 4,
    name: "4단계 · 가족편 (끝판왕)", //=> 가족편편
    bodyClass: "stage4",
    durationSec: 10,                 // 마지막 10s
    baseFallSpeed: 160,              // 매우 빠름
    spawnIntervalMinMax: [430, 700],
    maxConcurrent: 12,
    speedMul: 1.15,
    spawnMul: 1.12,
    words: [
      "이리 와봐","성적표 가져와","성적이 왜 그래","요즘 뭐하냐?","휴대폰 줘봐",
      "방 청소 했냐?","너 또 밤샜지?","넌 맨날 공부 안 해","옆집 애는 벌써…",
      "아빠랑 얘기 좀 하자","엄마랑 얘기 좀 해","내일이 시험아니야?","시험 며칠 남았는데",
      "니는 나이가 몇갠데","잘하는 짓이다","엄마 어릴땐 안 그랬다","니는 누굴 닮았노","게임 좀 그만해",
      "뭐 해먹고 살래"
    ],
  },
];

/* -----------------------------------------
 * 2) 페이즈 타임라인(요청된 흐름을 그대로)
 * -----------------------------------------
 * type: 'stage' | 'rest'
 * stage: stages[] 인덱스 (type='stage'일 때만)
 * duration: 해당 페이즈 길이(초)
 * nextStage: 다음 시작될 스테이지 인덱스(휴식 페이즈 전용)
 * final: 마지막 스테이지 표시 플래그(엔딩 연출 등에 사용 가능)
 */
const phasePlan = [
  { type: 'stage', stage: 0, duration: 20 },     // D1 25s
  { type: 'rest',  duration: 5, nextStage: 1 }, // 10s 휴식
  { type: 'stage', stage: 1, duration: 20 },     // D2 25s
  { type: 'rest',  duration: 5, nextStage: 2 }, // 10s 휴식
  { type: 'stage', stage: 2, duration: 20 },     // D3 25s
  { type: 'rest',  duration: 10, nextStage: 3 }, // 15s 휴식
  { type: 'stage', stage: 3, duration: 15, final: true }, // D4 10s (끝판왕)
];

/* -----------------------------------------
 * 3) DOM 참조
 * ----------------------------------------- */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const stageNameEl = document.getElementById("stageName");  // HUD 스테이지명
const timeLeftEl = document.getElementById("timeLeft");    // HUD 타이머
const scoreEl = document.getElementById("score");          // HUD 점수
const bestScoreEl = document.getElementById("bestScore");  // HUD 최고점
const messageEl = document.getElementById("message");      // 중앙 메시지(전환/휴식)
const scoreBigEl = document.getElementById("scoreBig");    // 캔버스 상단 중앙 대형 점수
const btnStart = document.getElementById("btnStart");
const btnPause = document.getElementById("btnPause");
const btnRestart = document.getElementById("btnRestart");
const touchLeft = document.getElementById("touchLeft");
const touchRight = document.getElementById("touchRight");

/* 플레이어 캐릭터 이미지 로드 */
const playerImage = new Image();
playerImage.src = '../cat.jpg';
let playerImageLoaded = false;
playerImage.addEventListener('load', () => {
  playerImageLoaded = true;
});
playerImage.addEventListener('error', () => {
  playerImageLoaded = false;
  console.warn('character.jpg 이미지를 불러오지 못했습니다. 기본 도형을 사용합니다.');
});

/* 캔버스 내부 논리 좌표(픽셀). 렌더는 CSS에서 반응형으로 스케일됨 */
const W = canvas.width;   // 1024
const H = canvas.height;  // 576

const loadStoredBestScore = () => {
  const raw = Number(localStorage.getItem("avoider_best"));
  return Number.isFinite(raw) ? Math.floor(raw) : 0;
};

/* -----------------------------------------
 * 4) 게임 상태 객체
 * ----------------------------------------- */
let state = {
  running: false,     // 게임이 실행 중인지
  paused: false,      // 일시정지 상태인지

  // 페이즈(스테이지/휴식) 상태
  phaseIndex: 0,      // 현재 phasePlan 인덱스
  phaseTimeLeft: 0,   // 현재 페이즈 남은 시간(초)
  mode: 'stage',      // 'stage' or 'rest'
  stageIndex: 0,      // 현재 진행 중인 stages[] 인덱스

  // 스테이지 진행 시간(스폰 가중 등에 사용)
  stageElapsed: 0,

  // 점수 관리
  score: 0,
  bestScore: loadStoredBestScore(),

  // 플레이어(사각형/캡슐)
  player: {
    x: W * 0.5 - 24,
    y: H - 82,
    width: 48,
    height: 48,
    speed: 380,  // 좌우 이동 속도(px/s)
    vx: 0,       // 현재 x축 방향(-1,0,1)
  },

  // 장애물(떨어지는 텍스트) 리스트
  obstacles: [],
  lastSpawn: 0,       // 마지막 스폰 이후 경과(ms)
  nextSpawnIn: 800,   // 다음 스폰까지 남은 시간(ms)

  // 입력 상태
  keys: { left: false, right: false },

  // 프레임 간 시간 계산용
  lastTime: 0,
};
bestScoreEl.textContent = String(state.bestScore);

/* -----------------------------------------
 * 5) 유틸 함수
 * ----------------------------------------- */
const rand = (min, max) => Math.random() * (max - min) + min;
const choice = arr => arr[(Math.random() * arr.length) | 0];

function setBodyClass(cls) {
  // 단계 전환 시 body의 배경 클래스를 교체
  document.body.classList.remove("stage1","stage2","stage3","stage4");
  document.body.classList.add(cls);
}

function showMessage(text, ms = 1200) {
  // 중앙 안내 메시지를 일정 시간 표시
  messageEl.innerHTML = `<span>${text}</span>`;
  messageEl.classList.remove("hidden");
  clearTimeout(showMessage._t);
  showMessage._t = setTimeout(() => messageEl.classList.add("hidden"), ms);
}

function resetPlayer() {
  // 플레이어를 바닥 중앙으로 리스폰
  state.player.x = W * 0.5 - state.player.width / 2;
  state.player.y = H - 82;
  state.player.vx = 0;
}

function bodyIsDark() {
  // 다크 스테이지(4단계)에서는 텍스트 색 대비를 높이기 위한 플래그
  return document.body.classList.contains("stage4");
}

/* -----------------------------------------
 * 6) 난이도 스케일러(시간·스테이지 기반 가중치)
 * -----------------------------------------
 * - progress(0~1): 현재 스테이지 경과율
 * - stageIndex(0~3): 스테이지 번호(0부터 시작)
 * - 모든 값은 체감 난이도 조절용이며, CPU 부담을 최소화함
 */
function fallSpeedScale(progress, stageIndex){
  // 낙하 속도: 후반으로 갈수록 가속(최대 +85%) + 스테이지마다 +12%
  const timeFactor  = 1 + 0.85 * progress;
  const stageFactor = 1 + 0.12 * stageIndex;
  return timeFactor * stageFactor;
}

function spawnIntervalScale(progress, stageIndex){
  // 스폰 간격: 후반으로 갈수록 40% 단축, 스테이지마다 6% 추가 단축
  const timeShrink  = 1 - 0.40 * progress;
  const stageShrink = 1 - 0.06 * stageIndex;
  // 하한선 50% (너무 과도한 생성 폭주는 방지)
  return Math.max(0.5, timeShrink * stageShrink);
}

function driftPerStage(stageIndex){
  // 수평 드리프트 속도(px/s): 스테이지가 높을수록 좌우 흔들림 증가
  return stageIndex * 35;
}

function doubleSpawnChance(progress, stageIndex){
  // 이중 스폰 확률: 후반 + 고스테이지에서 증가(최대 38%)
  const base  = 0.06 + 0.06 * stageIndex;           // 6/12/18/24 %
  const bonus = 0.16 * Math.max(0, progress - 0.4); // 진행률 40% 이후 최대 +16%
  return Math.min(0.38, base + bonus);
}

/* -----------------------------------------
 * 7) 페이즈 전환 로직
 * ----------------------------------------- */
function startPhase(index = 0){
  // 특정 인덱스의 페이즈를 시작
  state.phaseIndex = index;
  const phase = phasePlan[state.phaseIndex];
  state.mode = phase.type;
  state.phaseTimeLeft = phase.duration;

  if (phase.type === 'stage') {
    // 실제 스테이지 플레이 시작
    startStage(phase.stage, phase.duration);
  } else {
    // 휴식 페이즈 진입
    startRest(phase.duration);
  }
}

function nextPhase(){
  // 다음 페이즈로 이동. 마지막이면 게임 클리어
  if (state.phaseIndex < phasePlan.length - 1) {
    startPhase(state.phaseIndex + 1);
  } else {
    endGame(true);
  }
}

/* -----------------------------------------
 * 8) 스테이지 시작
 * -----------------------------------------
 * stageIndex: 진행할 스테이지(0~3)
 * durationOverride: 페이즈에서 지정한 시간(초). 없으면 stages 기본값 사용
 */
function startStage(stageIndex = 0, durationOverride){
  state.stageIndex = stageIndex;
  const s = stages[state.stageIndex];

  // HUD/배경 갱신
  stageNameEl.textContent = s.name;
  setBodyClass(s.bodyClass);

  // 스테이지 상태 초기화
  state.mode = 'stage';
  state.stageElapsed = 0;
  state.obstacles = [];
  state.lastSpawn = 0;
  // spawnMul(스테이지별 스폰 가중)을 반영하여 첫 스폰 간격 산출
  state.nextSpawnIn = rand(...s.spawnIntervalMinMax) / (s.spawnMul || 1);

  // 페이즈 남은 시간 설정 (override가 우선)
  state.phaseTimeLeft = durationOverride ?? s.durationSec;

  resetPlayer();

  // 시작 안내 (끝판왕이면 특수 문구)
  const title = state.stageIndex === 3 ? "끝판왕 시작!" : `현실 난이도 상승! (${s.name})`;
  showMessage(title, 1200);
}

/* -----------------------------------------
 * 9) 휴식 시작
 * -----------------------------------------
 * duration: 휴식 시간(초)
 * - 스폰/충돌 멈추고, 중앙 메시지로 휴식 알림
 * - 휴식 종료 직전 3초부터 다음 단계 카운트다운 메시지 표시
 */
function startRest(duration){
  state.mode = 'rest';
  state.obstacles = [];         // 휴식에 들어가면 남아있는 텍스트 제거
  state.lastSpawn = 0;
  state.nextSpawnIn = Infinity; // 스폰 비활성화
  resetPlayer();

  // 방금 끝난 스테이지 이름 추출 (phaseIndex - 1 기준)
  const justClearedStage = phasePlan[state.phaseIndex - 1]?.stage ?? state.stageIndex;
  const clearedName = stages[justClearedStage]?.name?.split(" · ")[0] || "1단계";
  showMessage(`${clearedName} 끝! ${duration}초간 휴식`, 1500);

  // HUD에도 휴식 상태 표시
  stageNameEl.textContent = `휴식 · ${duration}s`;
}

/* -----------------------------------------
 * 10) 게임 전역 제어 (시작/일시정지/재시작/엔딩)
 * ----------------------------------------- */
function startGame() {
  state.running = true;
  state.paused = false;
  state.score = 0;
  scoreBigEl.textContent = "0";
  startPhase(0); // 첫 페이즈(D1) 시작
  state.lastTime = performance.now();
  loop(state.lastTime);
}

function pauseGame() {
  state.paused = !state.paused;
  showMessage(state.paused ? "일시정지" : "재개", 600);
  if (!state.paused) {
    // 재개 시 타이밍 기준 재설정
    state.lastTime = performance.now();
    loop(state.lastTime);
  }
}

function restartGame() {
  state.running = false;
  state.paused = false;
  state.obstacles = [];
  startGame();
}

function endGame(cleared = false) {
  state.running = false;

  // 최고점 갱신 저장
  const finalScore = Math.floor(state.score);
  if (finalScore > state.bestScore) {
    state.bestScore = finalScore;
    localStorage.setItem("avoider_best", String(state.bestScore));
    bestScoreEl.textContent = String(state.bestScore);
  }

  // 엔딩 메시지
  const msg = cleared
    ? `🎉 모든 현실을 피했다! 총 점수: ${finalScore}`
    : `💥 부딪혔어! 총 점수: ${finalScore}`;
  showMessage(msg, 2200);
}

/* -----------------------------------------
 * 11) 입력 처리 (키보드 / 모바일 터치)
 * ----------------------------------------- */
window.addEventListener("keydown", (e) => {
  const lowerKey = e.key.toLowerCase();

  if (lowerKey === 'm' && e.shiftKey) {
    e.preventDefault();
    window.location.href = '../index.html';
    return;
  }

  if (e.key === "ArrowLeft" || lowerKey === "a") state.keys.left = true;
  if (e.key === "ArrowRight" || lowerKey === "d") state.keys.right = true;
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") state.keys.left = false;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") state.keys.right = false;
});

/* 모바일 좌/우 패드용 플래그 */
let leftPressing = false, rightPressing = false;
/* 터치 바인딩 유틸: passive:false로 기본 스크롤 제스처를 막고 즉시 반응 */
const bindTouch = (el, setFlag) => {
  el.addEventListener("touchstart", (ev) => { ev.preventDefault(); setFlag(true); }, { passive: false });
  el.addEventListener("touchend",   (ev) => { ev.preventDefault(); setFlag(false); }, { passive: false });
};
bindTouch(touchLeft,  (v) => { leftPressing  = v; });
bindTouch(touchRight, (v) => { rightPressing = v; });

/* -----------------------------------------
 * 12) 스폰 로직
 * ----------------------------------------- */
function canSpawn() {
  // 현재 화면에 존재하는 텍스트 수가 스테이지 상한보다 작을 때만 스폰 허용
  const s = stages[state.stageIndex];
  return state.obstacles.length < (s.maxConcurrent ?? Infinity);
}

function spawnObstacle() {
  // 현재 스테이지 설정 참조
  const s = stages[state.stageIndex];
  const text = choice(s.words);

  // 진행률(progress) 계산: 0~1
  //  - 스폰/속도 가중치 계산에 사용
  const phaseDur = phasePlan[state.phaseIndex]?.duration || s.durationSec;
  const progress = s.durationSec > 0 ? (state.stageElapsed / phaseDur) : 0;

  // 폰트 크기: 스테이지가 높을수록 살짝 크고, 소폭 랜덤
  const baseSize = 20 + 2 * state.stageIndex;
  const fontSize = Math.floor(rand(baseSize, baseSize + 10));
  const fontFamily = `"Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;

  // 텍스트 가로폭 계산(충돌/스폰 위치에 활용)
  ctx.save();
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  const width = ctx.measureText(text).width;
  ctx.restore();

  // 초기 위치: 화면 상단 바깥(y<0), 가로 랜덤
  const x = rand(12, W - width - 12);
  const y = -fontSize * 1.2;

  // 낙하 속도: base * (스테이지 배수) * (시간/스테이지 가중치)
  const baseVy = s.baseFallSpeed * (s.speedMul || 1) + rand(-8, 12);
  const vy = baseVy * fallSpeedScale(progress, state.stageIndex);

  // 수평 드리프트: 스테이지가 높을수록 크게, 후반으로 갈수록 소폭 증가
  const drift = driftPerStage(state.stageIndex) + 22 * progress;
  const vx = rand(-drift, drift);

  // 장애물 배열에 추가
  state.obstacles.push({
    text, x, y, w: width, h: fontSize * 1.35,
    vy, vx, fontSize,
  });
}

/* -----------------------------------------
 * 13) 충돌 판정(AABB)
 * ----------------------------------------- */
function isColliding(ax, ay, aw, ah, bx, by, bw, bh) {
  // AABB: 두 직사각형의 x/y 범위가 겹치면 충돌
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/* -----------------------------------------
 * 14) 업데이트(물리/스폰/시간/점수) & 렌더(그리기)
 * ----------------------------------------- */
function update(dt) {
  // 1) 플레이어 이동(휴식 중에도 움직일 수 있게 유지)
  const p = state.player;
  const left = state.keys.left || leftPressing;
  const right = state.keys.right || rightPressing;
  p.vx = (left ? -1 : 0) + (right ? 1 : 0);
  p.x += p.vx * p.speed * dt;
  // 화면 경계 체크
  p.x = Math.max(0, Math.min(W - p.width, p.x));

  // 2) 모드에 따라 분기
  if (state.mode === 'stage') {
    const s = stages[state.stageIndex];

    // 2-1) 장애물 이동 + 수평 드리프트 벽 튕김
    for (const o of state.obstacles) {
      o.y += o.vy * dt;
      if (o.vx) {
        o.x += o.vx * dt;
        // 좌우 경계에서 반사
        if (o.x < 8) { o.x = 8; o.vx *= -1; }
        if (o.x + o.w > W - 8) { o.x = W - 8 - o.w; o.vx *= -1; }
      }
    }

    // 2-2) 화면 밖으로 나간 장애물 제거
    state.obstacles = state.obstacles.filter(o => o.y < H + 60);

    // 2-3) 충돌 체크: 하나라도 닿으면 게임 종료
    for (const o of state.obstacles) {
      if (isColliding(p.x, p.y, p.width, p.height, o.x, o.y, o.w, o.h)) {
        endGame(false);
        return;
      }
    }

    // 2-4) 스폰 타이밍 계산(난이도 곡선에 따른 간격 단축 + 이중 스폰)
    state.lastSpawn += dt * 1000;
    const phaseDur = phasePlan[state.phaseIndex]?.duration ?? s.durationSec;
    const progress = Math.min(1, state.stageElapsed / phaseDur);
    const [minI, maxI] = s.spawnIntervalMinMax;
    // spawnMul(스테이지별 스폰량 조절)을 간격에 반영
    const intervalScale = spawnIntervalScale(progress, state.stageIndex) / (s.spawnMul || 1);
    const targetInterval = rand(minI, maxI) * intervalScale;

    if (state.lastSpawn >= state.nextSpawnIn && canSpawn()) {
      spawnObstacle();
      // 후반 & 고스테이지에서 보조 스폰(약간의 지연을 두고 1개 더)
      if (Math.random() < doubleSpawnChance(progress, state.stageIndex) && canSpawn()) {
        setTimeout(() => {
          if (state.running && state.mode === 'stage' && canSpawn()) spawnObstacle();
        }, rand(60, 140));
      }
      state.lastSpawn = 0;
      state.nextSpawnIn = targetInterval;
    }

    // 2-5) 시간/점수 진행
    state.stageElapsed += dt;
    state.phaseTimeLeft = Math.max(0, state.phaseTimeLeft - dt);
    state.score += dt; // 생존 시간 1초 = 1점

    // 2-6) 스테이지 종료 → 다음 페이즈(휴식)로 이동
    if (state.phaseTimeLeft <= 0) {
      nextPhase();
      return;
    }
  } else {
    // === 휴식 모드 ===
    // 3-1) 카운트다운만 진행(장애물/충돌 없음)
    state.phaseTimeLeft = Math.max(0, state.phaseTimeLeft - dt);

    // 3-2) 휴식 종료 직전 3초부터 다음 스테이지 시작 카운트 메시지
    const restLeft = Math.ceil(state.phaseTimeLeft);
    const next = phasePlan[state.phaseIndex]?.nextStage;
    if (restLeft <= 3 && typeof next === 'number') {
      // "2단계 시작 3..." 형태로 표기
      const nextName = stages[next].name.replace(/·.*/, "").trim(); // "2단계"
      messageEl.classList.remove("hidden");
      messageEl.innerHTML = `<span>${nextName} 시작 ${restLeft}...</span>`;
    }
    // 휴식 종료 → 다음 페이즈(=대부분 스테이지 시작)
    if (state.phaseTimeLeft <= 0) {
      nextPhase();
      return;
    }
  }

  // 4) HUD/대형 점수 동기화
  timeLeftEl.textContent = state.phaseTimeLeft.toFixed(1);
  const shownScore = Math.floor(state.score);
  scoreEl.textContent = String(shownScore);
  scoreBigEl.textContent = String(shownScore);
}

function render() {
  // 캔버스 클리어(배경은 body CSS로 처리)
  ctx.clearRect(0, 0, W, H);

  // 플레이어(캡슐 형태)
  const p = state.player;
  drawPlayer(p.x, p.y, p.width, p.height, bodyIsDark() ? "#ffffff" : "#111111");

  // 텍스트(외곽선 + 면 채우기)
  for (const o of state.obstacles) drawWord(o);
}

/* -----------------------------------------
 * 15) 도형/텍스트 그리기
 * ----------------------------------------- */
function drawPlayer(x, y, w, h, color="#111") {
  if (playerImageLoaded) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(playerImage, x, y, w, h);
    ctx.restore();
    return;
  }

  // 이미지 로드 전에는 라운드 사각형(캡슐)으로 플레이어 표시
  const r = Math.min(w, h) * 0.45;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWord(o) {
  // 다크 스테이지에서는 흰색, 그 외 진한 남색 계열로 대비 강화
  const isDark = bodyIsDark();
  ctx.save();
  ctx.font = `900 ${o.fontSize}px "Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
  ctx.fillStyle = isDark ? "white" : "#0f172a";
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.22)";
  ctx.lineWidth = 3;
  ctx.strokeText(o.text, o.x, o.y + o.fontSize);
  ctx.fillText(o.text, o.x, o.y + o.fontSize);
  ctx.restore();
}

/* -----------------------------------------
 * 16) 게임 루프 (requestAnimationFrame)
 * -----------------------------------------
 * - dt(델타타임): 프레임 간 경과 시간(초). 물리/스폰 계산에 사용.
 * - 상한 0.033 ≒ 30fps 델타로 제한하여 급격한 튐 방지.
 */
function loop(now) {
  if (!state.running || state.paused) return;
  const dt = Math.min(0.033, (now - state.lastTime) / 1000);
  state.lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

/* -----------------------------------------
 * 17) 버튼/가시성 이벤트
 * ----------------------------------------- */
btnStart.addEventListener("click", () => { if (!state.running) startGame(); });
btnPause.addEventListener("click", () => { if (state.running) pauseGame(); });
btnRestart.addEventListener("click", () => { restartGame(); });

/* 탭 전환 시 자동 일시정지(예상치 못한 사망 방지) */
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.running && !state.paused) pauseGame();
});

/* 초기 안내 메시지 */
showMessage("버튼을 눌러 시작하세요", 1200);
