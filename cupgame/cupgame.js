// =====================================================================
// 🎯 야바위 게임 (4단계 난이도 포함)
// - 기존 로직/기능은 그대로 유지
// - 함수/변수 이름을 더 직관적으로 다듬고, 주석을 풍부하게 추가
// - CSS의 .flash 클래스를 토글하여 4단계에서 깜빡임 효과 제공
// =====================================================================

// --------- DOM 참조 (화면 요소 핸들) ----------------------------------
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const stageText = document.getElementById("stageText");
const retryText = document.getElementById("retryText");
const totalRewardsElement = document.getElementById("totalRewards");
const resultElement = document.getElementById("result");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");

// --------- 게임 전역 상태값 ------------------------------------------
// gameState: 'ready' (라운드 준비) → 'mixing' (섞는 중) → 'selecting' (플레이어 선택)
//            → 'result' (정오답 표시) → 'choice' (GO/STOP) → 'final' (최종 보상 표시)
let gameState = 'ready';
let currentStage = 1;          // 1~4 단계
let totalRewards = 0;          // 누적 보상
let earnedRewards = 0;         // 확정(보관)된 보상 (실패 시 이 값은 유지)
let selectedCup = -1;          // 유저가 선택한 컵 인덱스
let ballCupIndex = 0;          // 공이 들어있는 컵 인덱스
let isMixing = false;          // 섞기 루프 진행 플래그
let mixStep = 0;               // (참고용) 섞기 진행 단계 카운터
let flashInterval = null;      // 4단계 깜빡임 setInterval 핸들
let isInRetryAttempt = false;  // 재시도 라운드 여부 (포기 보상 계산용)
let showCupNumbers = false;    // Alt+M으로 컵 번호 표기 토글

// --------- 난이도 설정 (라운드별 파라미터) ---------------------------
// speed: 값이 작을수록 빠름 (swapDuration 프레임 수)
// swaps: 교환 횟수 (많을수록 난이도 ↑)
// retries: 재시도 가능 횟수 (Infinity는 무한)
const stageConfig = {
  1: { cups: 3, speed: 50, swaps: 4,  retries: Infinity, reward: 1 },
  2: { cups: 3, speed: 30, swaps: 6,  retries: 0,        reward: 2 },
  3: { cups: 5, speed: 20, swaps: 15, retries: 1,        reward: 5 },
  4: { cups: 5, speed: 10, swaps: 30, retries: 2,        reward: 7, flash: true }
};

/* 🔎 난이도 튜닝 팁
 * - cups: 3(쉬움) / 5(어려움)
 * - speed: 60(매우 느림) → 40(보통) → 30(빠름) → 20(매우 빠름)
 * - swaps: 4(쉬움) → 6~8(보통) → 10+(어려움)
 * - retries: Infinity(무한) → 2~3(제한) → 1(한 번만) → 0(불가)
 * - flash: true면 4단계에서 깜빡임 (시각적 방해) 활성화
 */

let retriesLeft = stageConfig[1].retries;
let retriesUsed = 0;
let previousSwapPair = null;   // 직전 교환쌍 기록 (동일쌍 반복 방지)

// =====================================================================
// 🧱 컵 객체 (캔버스에 그려지는 원형 컵)
// - position(originalX/Y)과 현재 위치(x/y)를 함께 유지하여
//   실제 '자리' 교환을 정확히 반영
// =====================================================================
class Cup {
  constructor(x, y, radius, color, index) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.index = index;       // 고정 ID (1,2,3...)
    this.originalX = x;       // "자리" 기준점 (섞을 때 이 값이 서로 바뀜)
    this.originalY = y;
    this.isSelected = false;  // 유저가 클릭해서 선택한 컵 강조
  }
  
  // 현재 프레임에 컵(그리고 필요 시 공) 그리기
  draw() {
    // 1) 컵 그림자 (살짝 오른쪽/아래로)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(this.x + 5, this.y + 5, this.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // 2) 컵 본체 (선택 시 밝게 강조)
    ctx.fillStyle = this.isSelected ? '#ffeb3b' : this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // 3) 컵 테두리
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // 4) (디버그) 컵 번호 ON/OFF
    if (showCupNumbers) {
      ctx.fillStyle = '#000';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((this.index + 1).toString(), this.x, this.y);
    }
    
    // 5) 공 표시: 준비 상태 or 결과 표시 단계에서만 보임
    if (this.index === ballCupIndex && (gameState === 'ready' || gameState === 'result')) {
      // 공 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(this.x + 3, this.y + 3, 18, 0, Math.PI * 2);
      ctx.fill();
      
      // 공 본체 (빨강)
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
      ctx.fill();
      
      // 공 하이라이트
      ctx.fillStyle = '#ff6666';
      ctx.beginPath();
      ctx.arc(this.x - 5, this.y - 5, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // 부드러운 반짝임 (조도 강조)
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.arc(this.x - 3, this.y - 3, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // 위치 변경 (프레임 단위 이동에 사용)
  setPosition(x, y) { this.x = x; this.y = y; }
  
  // (마우스 좌표가 원 내부인지) 클릭 히트 테스트
  contains(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    return dx * dx + dy * dy <= this.radius * this.radius;
  }
}

// =====================================================================
// 🧩 보드 구성/교환 큐/교환 실행
// =====================================================================
let cups = [];           // 화면에 존재하는 컵 리스트
let swapQueue = [];      // 앞으로 실행할 교환쌍 목록 (FIFO)
let activeSwaps = [];    // 현재 프레임에서 동시에 진행 중인 교환쌍

// (1) 컵 배치 만들기: 3개면 가로 줄, 5개면 2-3 배열
function layoutCups(numCups) {
  cups = [];
  if (numCups === 3) {
    // 가운데 정렬된 3개
    for (let i = 0; i < 3; i++) {
      cups.push(new Cup(250 + i * 200, 300, 50, '#4CAF50', i));
    }
  } else if (numCups === 5) {
    // 위쪽 2개, 아래쪽 3개 (오각형 느낌)
    cups.push(new Cup(300, 200, 50, '#4CAF50', 0));
    cups.push(new Cup(600, 200, 50, '#4CAF50', 1));
    cups.push(new Cup(200, 350, 50, '#4CAF50', 2));
    cups.push(new Cup(450, 350, 50, '#4CAF50', 3));
    cups.push(new Cup(700, 350, 50, '#4CAF50', 4));
  }
}

// (2) 한 라운드를 준비 상태로 초기화
function setupRound() {
  // 4단계 깜빡임이 남아있다면 정리
  if (flashInterval) {
    clearInterval(flashInterval);
    flashInterval = null;
    canvas.style.opacity = '1';
    canvas.classList.remove('flash');
  }
  
  gameState = 'ready';
  selectedCup = -1;
  isMixing = false;
  mixStep = 0;
  swapQueue = [];
  activeSwaps = [];
  previousSwapPair = null;
  showCupNumbers = false; // 번호 표시는 기본 OFF
  
  const config = stageConfig[currentStage];
  layoutCups(config.cups);
  
  // 시작 시 공은 임의 컵에 배치
  ballCupIndex = Math.floor(Math.random() * config.cups);
  
  cups.forEach(cup => (cup.isSelected = false));
  retriesLeft = config.retries;
  
  updateHud();
  resultElement.textContent = '';
  startBtn.textContent = '공 섞기 시작';
  startBtn.disabled = false;
}

// (3) 상단 HUD 텍스트 갱신
function updateHud() {
  stageText.textContent = `단계 ${currentStage} / 4`;
  totalRewardsElement.textContent = totalRewards;
  
  const config = stageConfig[currentStage];
  if (config.retries === Infinity) retryText.textContent = '재시도: 무한';
  else if (config.retries === 0)   retryText.textContent = '재시도: 불가';
  else                             retryText.textContent = `재시도: ${retriesLeft}회 남음`;
}

// (4) 교환 큐 만들기: 직전 쌍과 동일한 조합은 피함
function buildSwapQueue(numSwaps, numCups) {
  const queue = [];
  let lastPair = previousSwapPair;
  
  for (let i = 0; i < numSwaps; i++) {
    let idx1, idx2;
    let attempts = 0;
    do {
      idx1 = Math.floor(Math.random() * numCups);
      idx2 = Math.floor(Math.random() * numCups);
      attempts++;
    } while (
      (idx2 === idx1 ||
       (lastPair && lastPair[0] === idx1 && lastPair[1] === idx2) ||
       (lastPair && lastPair[0] === idx2 && lastPair[1] === idx1)) &&
      attempts < 50
    );
    queue.push([idx1, idx2]);
    lastPair = [idx1, idx2];
  }
  previousSwapPair = queue[queue.length - 1];
  return queue;
}

// (5) 실제 섞기 루프: 동시에 1~2쌍까지 애니메이션
function runMixingLoop() {
  if (!isMixing) return;
  const config = stageConfig[currentStage];
  const swapDuration = config.speed; // 작을수록 빠르게 바뀜
  
  // 큐가 비었고 진행 중인 교환이 없으면 새 큐 생성
  if (swapQueue.length === 0 && activeSwaps.length === 0) {
    swapQueue = buildSwapQueue(config.swaps, config.cups);
  }
  
  // 동시 교환 허용 개수: 5컵 이상이면 2쌍, 아니면 1쌍
  const maxConcurrentSwaps = config.cups >= 5 ? 2 : 1;
  while (activeSwaps.length < maxConcurrentSwaps && swapQueue.length > 0) {
    const [idx1, idx2] = swapQueue.shift();
    
    // 이미 사용 중인 컵은 중복으로 잡지 않기
    const isUsed = activeSwaps.some(swap =>
      swap.idx1 === idx1 || swap.idx1 === idx2 ||
      swap.idx2 === idx1 || swap.idx2 === idx2
    );
    if (!isUsed) {
      activeSwaps.push({
        idx1, idx2,
        progress: 0,
        startX1: cups[idx1].originalX,
        startY1: cups[idx1].originalY,
        startX2: cups[idx2].originalX,
        startY2: cups[idx2].originalY,
        swapped: false
      });
    }
  }
  
  // 모든 진행 중 교환쌍 처리
  for (let i = activeSwaps.length - 1; i >= 0; i--) {
    const swap = activeSwaps[i];
    swap.progress += 1 / swapDuration;          // 0 → 1 로 이동
    const t = Math.min(swap.progress, 1);
    
    const cup1 = cups[swap.idx1];
    const cup2 = cups[swap.idx2];
    const midY = Math.min(swap.startY1, swap.startY2) - 100; // 위로 볼록한 곡선
    
    // 베지어 곡선 보간 (x는 선형, y는 2차 곡선으로 아크형 이동)
    const x1 = swap.startX1 + (swap.startX2 - swap.startX1) * t;
    const y1 = (1 - t) * (1 - t) * swap.startY1 + 2 * (1 - t) * t * midY + t * t * swap.startY2;
    const x2 = swap.startX2 + (swap.startX1 - swap.startX2) * t;
    const y2 = (1 - t) * (1 - t) * swap.startY2 + 2 * (1 - t) * t * midY + t * t * swap.startY1;
    cup1.setPosition(x1, y1);
    cup2.setPosition(x2, y2);
    
    // 스왑 완료 처리 (자리 교환 확정)
    if (t >= 1.0 && !swap.swapped) {
      swap.swapped = true;
      
      if (showCupNumbers) {
        console.log(`교환 완료: 컵 ${swap.idx1 + 1} ↔ 컵 ${swap.idx2 + 1}, 공 위치: 컵 ${ballCupIndex + 1}`);
      }
      // 컵의 '자리' 갱신 (originalX/Y만 서로 교환)
      const { startX1, startY1, startX2, startY2 } = swap;
      cup1.originalX = startX2;
      cup1.originalY = startY2;
      cup2.originalX = startX1;
      cup2.originalY = startY1;
      
      // 진행 중 교환쌍 리스트에서 제거
      activeSwaps.splice(i, 1);
    }
  }
  
  // 모든 교환이 끝났다면 선택 단계로 전환
  if (swapQueue.length === 0 && activeSwaps.length === 0) {
    isMixing = false;
    gameState = 'selecting';
    startBtn.textContent = '컵을 선택하세요!';
    startBtn.disabled = true;
    
    // 4단계 깜빡임 종료
    if (flashInterval) {
      clearInterval(flashInterval);
      flashInterval = null;
      canvas.style.opacity = '1';
      canvas.classList.remove('flash');
    }
    // 공 인덱스가 유효한지 최종 확인 (안전망)
    verifyBallIndex();
  } else {
    // 60FPS 근사 (16ms) 간격으로 다음 프레임 예약
    setTimeout(runMixingLoop, 16);
  }
}

// (6) 공 인덱스가 배열 범위 내인지 확인 (안전장치)
function verifyBallIndex() {
  if (ballCupIndex < 0 || ballCupIndex >= cups.length) {
    console.warn('공 위치가 유효하지 않음, 첫 번째 컵으로 보정');
    ballCupIndex = 0;
  }
  if (showCupNumbers) {
    console.log(`최종 공 위치: 컵 ${ballCupIndex + 1}번`);
    console.log(`컵 ${ballCupIndex + 1}번 자리: (${cups[ballCupIndex].originalX}, ${cups[ballCupIndex].originalY})`);
  }
}

// =====================================================================
// ▶️ 라운드 시작/선택/보상 처리
// =====================================================================

// (A) "공 섞기 시작" 버튼 누르면 섞기 시작
function startMixing() {
  if (gameState !== 'ready') return;
  gameState = 'mixing';
  isMixing = true;
  startBtn.textContent = '섞는 중...';
  startBtn.disabled = true;
  
  const config = stageConfig[currentStage];
  // 4단계에서 깜빡임(시각적 방해) 활성화
  if (config.flash) {
    // 깜빡임 주기 (100ms: 매우 빠름)
    flashInterval = setInterval(() => {
      canvas.classList.toggle('flash');
    }, 100);
  }
  runMixingLoop();
}

// (B) 캔버스를 클릭했을 때: 컵 선택 시도
function handleCupClick(cupIndex) {
  if (gameState !== 'selecting') return;
  selectedCup = cupIndex;
  cups[cupIndex].isSelected = true;
  gameState = 'result';
  
  // 잠깐의 연출 후 정오답 판정
  setTimeout(() => {
    const config = stageConfig[currentStage];
    if (cupIndex === ballCupIndex) {
      // ✅ 정답
      resultElement.textContent = '정답! 단계 클리어!';
      resultElement.style.color = '#4CAF50';
      isInRetryAttempt = false;
      // 잠시 후 GO/STOP 선택지 제공
      setTimeout(() => showGoStopChoice(), 1500);
    } else {
      // ❌ 오답
      resultElement.textContent = '틀렸습니다!';
      resultElement.style.color = '#f44336';
      
      // 재시도 처리(남아있다면)
      setTimeout(() => {
        if (retriesLeft > 0 || retriesLeft === Infinity) {
          if (retriesLeft !== Infinity) {
            retriesLeft--;
            retriesUsed++;
          }
          isInRetryAttempt = true;
          resultElement.textContent = '재시도 가능!';
          setTimeout(() => setupRound(), 1000);
        } else {
          // 더 이상 재시도 불가 → 게임 리셋 (확정 보상만 유지)
          resultElement.textContent = '게임 오버! 처음부터 다시 시작합니다.';
          setTimeout(() => {
            currentStage = 1;
            totalRewards = earnedRewards; // 확정 보상 유지
            retriesUsed = 0;
            isInRetryAttempt = false;
            setupRound();
          }, 2000);
        }
      }, 1500);
    }
  }, 500);
}

// (C) 단계 클리어 후: GO/STOP 선택지 제공
function showGoStopChoice() {
  gameState = 'choice';
  const config = stageConfig[currentStage];
  resultElement.innerHTML = `<div style="margin-bottom: 20px;">단계 ${currentStage} 클리어! 보상 +${config.reward}</div>`;
  
  // 기본 버튼 잠시 숨기고, 임시 버튼 추가
  startBtn.style.display = 'none';
  resetBtn.style.display = 'none';
  const controlsDiv = document.querySelector('.controls');
  
  if (currentStage < 4) {
    const goBtn = document.createElement('button');
    goBtn.className = 'btn go';
    goBtn.textContent = 'GO (다음 단계)';
    goBtn.onclick = () => {
      totalRewards += config.reward;
      earnedRewards = totalRewards;
      currentStage++;
      retriesUsed = 0;
      isInRetryAttempt = false;
      removeChoiceButtons();
      setupRound();
    };
    controlsDiv.appendChild(goBtn);
  }
  
  const stopBtn = document.createElement('button');
  stopBtn.className = 'btn stop';
  stopBtn.textContent = 'STOP (보상 받기)';
  stopBtn.onclick = () => {
    totalRewards += config.reward;
    earnedRewards = totalRewards;
    removeChoiceButtons();
    presentFinalRewards();
  };
  controlsDiv.appendChild(stopBtn);
}

// (D) 임시(GO/STOP) 버튼 제거하고 기본 버튼 복구
function removeChoiceButtons() {
  const controlsDiv = document.querySelector('.controls');
  const extraButtons = controlsDiv.querySelectorAll('.btn.go, .btn.stop');
  extraButtons.forEach(btn => btn.remove());
  startBtn.style.display = 'inline-block';
  resetBtn.style.display = 'inline-block';
}

// (E) 최종 보상 안내 후 자동 리셋
function presentFinalRewards() {
  gameState = 'final';
  
  let partialReward = 0;
  if (isInRetryAttempt && retriesUsed > 0) {
    // 3단계: 재시도 중 포기 보상 2
    if (currentStage === 3) {
      partialReward = 2;
    // 4단계: 남은 재시도 수에 따라 4 또는 2
    } else if (currentStage === 4) {
      const maxRetries = stageConfig[4].retries;
      const retriesRemaining = maxRetries - retriesUsed;
      if (retriesRemaining === 1) partialReward = 4;
      else if (retriesRemaining === 0) partialReward = 2;
    }
    if (partialReward > 0) {
      totalRewards += partialReward;
      resultElement.innerHTML = `
        <div style="color: #ffd700;">
          게임 종료!<br>
          재시도 중 포기 보상: +${partialReward}<br>
          최종 총 보상: ${totalRewards}
        </div>`;
    } else {
      resultElement.innerHTML = `
        <div style="color: #ffd700;">
          게임 종료!<br>
          최종 총 보상: ${totalRewards}
        </div>`;
    }
  } else {
    resultElement.innerHTML = `
      <div style="color: #ffd700;">
        게임 종료!<br>
        최종 총 보상: ${totalRewards}
      </div>`;
  }
  
  updateHud();
  // 4초 뒤 완전 리셋
  setTimeout(() => {
    currentStage = 1;
    totalRewards = 0;
    earnedRewards = 0;
    retriesUsed = 0;
    isInRetryAttempt = false;
    setupRound();
  }, 4000);
}

// =====================================================================
// 🖍️ 렌더링 루프 (화면 그리기)
// =====================================================================

// 1 프레임 그리기
function drawFrame() {
  // 배경 그라데이션
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 컵/공 렌더링
  cups.forEach(cup => cup.draw());
  
  // 상단 안내 텍스트
  ctx.fillStyle = 'white';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  if (gameState === 'ready') {
    ctx.fillText('게임을 시작하려면 버튼을 누르세요!', canvas.width/2, 80);
  } else if (gameState === 'mixing') {
    ctx.fillText('컵들을 주의깊게 보세요!', canvas.width/2, 80);
  } else if (gameState === 'selecting') {
    ctx.fillText('공이 있는 컵을 찾으세요!', canvas.width/2, 80);
  }
}

// 애니메이션 루프 (requestAnimationFrame)
function animationLoop() {
  drawFrame();
  requestAnimationFrame(animationLoop);
}

// =====================================================================
// 🎛️ 이벤트 연결
// =====================================================================
startBtn.addEventListener('click', startMixing);

resetBtn.addEventListener('click', () => {
  // 깜빡임 정리
  if (flashInterval) {
    clearInterval(flashInterval);
    flashInterval = null;
    canvas.style.opacity = '1';
    canvas.classList.remove('flash');
  }
  // 전역 상태 초기화 후 새 라운드 준비
  currentStage = 1;
  totalRewards = 0;
  earnedRewards = 0;
  retriesUsed = 0;
  isInRetryAttempt = false;
  removeChoiceButtons();
  setupRound();
});

// 캔버스 클릭 → 해당 좌표에 있는 컵 찾기 → 선택 처리
canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  cups.forEach((cup, index) => {
    if (cup.contains(x, y)) handleCupClick(index);
  });
});

// Alt + M → 컵 번호 디버그 토글
document.addEventListener('keydown', (event) => {
  const pressedKey = event.key?.toLowerCase();
  if (pressedKey !== 'm') return;

  if (event.altKey) {
    event.preventDefault();
    showCupNumbers = !showCupNumbers;
    console.log(`컵 번호 표시: ${showCupNumbers ? 'ON' : 'OFF'}`);
    return;
  }

  if (event.shiftKey) {
    event.preventDefault();
    window.location.href = '../index.html';
  }
});

// =====================================================================
// 🚀 진입점: 한 번만 호출
// =====================================================================
setupRound();
animationLoop();
