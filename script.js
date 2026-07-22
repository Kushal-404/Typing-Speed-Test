/* ---------------------------------------------------------
   DATA
--------------------------------------------------------- */
const PARAGRAPHS = [
  "The old lighthouse keeper climbed the spiral stairs every evening, counting each worn stone step as the wind pressed cold against the glass. Below him the sea folded quietly into darkness, patient and enormous, waiting for a light it already trusted would come.",
  "In the workshop, sawdust drifted through a single shaft of afternoon light while the carpenter turned a rough plank over in his hands, reading its grain like a sentence he had written himself years ago and was only now learning to finish.",
  "Somewhere between the second and third cup of coffee, the idea finally arrived, not as a flash but as a slow unfolding, the way fog lifts off a valley to reveal a road that had been there the entire time.",
  "The train pulled away from the platform just as the rain began, and through the fogged window the city blurred into soft shapes of orange light, each one a window, each window a small unfinished story rushing past.",
  "She kept the letter in the same drawer for eleven years, not because she planned to read it again but because throwing it away felt like erasing a version of herself that had once been brave enough to write it.",
  "The market opened before dawn, stalls lit by bare bulbs strung between poles, vendors calling out prices in voices already hoarse, the smell of ginger and diesel mixing in the cool air like two arguments that never resolve.",
  "A good bridge does not announce itself, the engineer said, tapping the blueprint with one finger, it simply lets you cross without ever noticing the river was a problem at all.",
  "By the time the museum closed, only the night guard remained, walking past paintings whose colors seemed to deepen in the low light, as though the pigments had been waiting all day for someone to finally slow down and look."
];
 
const TIME_OPTIONS = [15, 30, 60];
const DEFAULT_TIME = 60;
 
/* ---------------------------------------------------------
   STATE
--------------------------------------------------------- */
let currentMode = 'menu'; // 'menu' | 'normal' | 'battle-select' | 'battle-ai' | 'battle-pvp' | 'battle-interstitial' | 'battle-result'
const ARENA_MODES = ['normal', 'battle-ai', 'battle-pvp']; // modes where the typing arena is live and listening

let lastBattleVariant = null; // 'ai' | 'pvp' — remembered for the Rematch button

// AI Mode: simulated bot opponent
let botTimerId = null;
let botActionTimeout = null;
let botCharsTyped = 0;
let botStartTime = 0;
let botTargetWpm = 0;

// PVP Mode: local hot-seat, two sequential rounds on the same paragraph
let pvpRound = 1;
let pvpSharedParagraph = '';
let pvpP1Stats = null;

let state = {
  selectedTime: DEFAULT_TIME,
  timeLeft: DEFAULT_TIME,
  timerId: null,
  started: false,
  finished: false,
  currentText: "",
  typedChars: [], 
  totalTyped: 0,
  totalCorrect: 0,
  totalErrors: 0,
  tabPressed: false,
};
 
/* ---------------------------------------------------------
   DOM REFS
--------------------------------------------------------- */
const el = {
  timeSelector: document.getElementById('timeSelector'),
  timerDisplay: document.getElementById('timerDisplay'),
  liveWpm: document.getElementById('liveWpm'),
  liveAcc: document.getElementById('liveAcc'),
  textDisplay: document.getElementById('textDisplay'),
  hiddenInput: document.getElementById('hiddenInput'),
  carriage: document.getElementById('carriage'),
  typingCard: document.getElementById('typingCard'),
  resultsCard: document.getElementById('resultsCard'),
  restartBtn: document.getElementById('restartBtn'),
  tryAgainBtn: document.getElementById('tryAgainBtn'),
  finalWpm: document.getElementById('finalWpm'),
  finalAcc: document.getElementById('finalAcc'),
  finalErrors: document.getElementById('finalErrors'),
  finalChars: document.getElementById('finalChars'),
  resultMeta: document.getElementById('resultMeta'),
  
  attacker: document.getElementById('attacker'),
  defender: document.getElementById('defender'),
  sword: document.getElementById('sword'),
  stageWrapper: document.getElementById('stageWrapper'),
  duelContainer: document.getElementById('duelContainer'),
  spark: document.getElementById('spark'),
  hitCount: document.getElementById('hitCount'),
  comboCount: document.getElementById('comboCount'),
  comboBadge: document.getElementById('comboBadge'),

  modeSelectScreen: document.getElementById('modeSelectScreen'),
  normalModeScreen: document.getElementById('normalModeScreen'),
  battleModeScreen: document.getElementById('battleModeScreen'),
  selectNormalBtn: document.getElementById('selectNormalBtn'),
  selectBattleBtn: document.getElementById('selectBattleBtn'),
  backToMenuBtn: document.getElementById('backToMenuBtn'),
  backFromBattleBtn: document.getElementById('backFromBattleBtn'),

  selectAiBtn: document.getElementById('selectAiBtn'),
  selectPvpBtn: document.getElementById('selectPvpBtn'),
  pvpTurnBanner: document.getElementById('pvpTurnBanner'),
  opponentStat: document.getElementById('opponentStat'),
  botWpm: document.getElementById('botWpm'),

  pvpInterstitialScreen: document.getElementById('pvpInterstitialScreen'),
  startPvpRound2Btn: document.getElementById('startPvpRound2Btn'),

  battleResultScreen: document.getElementById('battleResultScreen'),
  battleWinnerBanner: document.getElementById('battleWinnerBanner'),
  battleLeftLabel: document.getElementById('battleLeftLabel'),
  battleLeftWpm: document.getElementById('battleLeftWpm'),
  battleLeftAcc: document.getElementById('battleLeftAcc'),
  battleRightLabel: document.getElementById('battleRightLabel'),
  battleRightWpm: document.getElementById('battleRightWpm'),
  battleRightAcc: document.getElementById('battleRightAcc'),
  battleRematchBtn: document.getElementById('battleRematchBtn'),
  backFromBattleResultBtn: document.getElementById('backFromBattleResultBtn'),
};
 
let hitCount = 0;
let combo = 0;
let actionTimeout = null;

const ATTACK_TYPES = ['atk-thrust', 'atk-crosscut', 'atk-kick', 'atk-slash'];
const ATTACK_DURATIONS = { 'atk-thrust': 160, 'atk-crosscut': 180, 'atk-kick': 200, 'atk-slash': 180 };
 
/* ---------------------------------------------------------
   COMBAT ENGINE
--------------------------------------------------------- */
function pulse(elm, cls){
  elm.classList.remove(cls);
  void elm.getBoundingClientRect(); 
  elm.classList.add(cls);
}

function positionSpark() {
  const atkX = parseFloat(el.attacker.style.left);
  const defX = parseFloat(el.defender.style.left);
  const impactX = atkX + (defX - atkX) * 0.65;
  const impactY = 75; // Aligned with the new extended chest height
  
  el.spark.style.left = impactX + 'px';
  el.spark.style.bottom = impactY + 'px';
}

function triggerAttack(){
  hitCount += 1;
  combo += 1;
  el.hitCount.textContent = hitCount;
  el.comboCount.textContent = combo;
  el.comboBadge.classList.toggle('hidden-badge', combo < 8);
  
  const type = ATTACK_TYPES[hitCount % ATTACK_TYPES.length];
  
  clearTimeout(actionTimeout);
  // Strip active frames down to process incoming hit instantly
  el.attacker.classList.remove(...ATTACK_TYPES);
  pulse(el.attacker, type);
  pulse(el.attacker, 'lunge-step');
  
  const kb = Math.min(combo * 0.9, 16); 
  el.defender.style.setProperty('--kb', kb + 'px');
  pulse(el.defender, 'state-hit');
  
  positionSpark();
  pulse(el.spark, 'spark-show');

  actionTimeout = setTimeout(() => {
    el.attacker.classList.remove(type);
  }, ATTACK_DURATIONS[type]);
}
 
function triggerMiss(){
  combo = 0;
  el.comboCount.textContent = 0;
  el.comboBadge.classList.add('hidden-badge');
  clearTimeout(actionTimeout);
  el.attacker.classList.remove(...ATTACK_TYPES);
  pulse(el.attacker, 'state-miss');
  pulse(el.defender, 'state-gloat');

  actionTimeout = setTimeout(() => {
    el.attacker.classList.remove('state-miss');
  }, 250);
}

function updateStageProgression(idx, total) {
    if (total === 0) return;
    const progressPct = idx / total;

    el.carriage.style.left = (progressPct * 100) + "%";

    const stageWidth = el.duelContainer.offsetWidth;
    const startX = 50; 
    const gap = 100; 
    
    const totalMoveDist = stageWidth - gap - (startX * 2);
    
    const currentAtkX = startX + (totalMoveDist * progressPct);
    const currentDefX = currentAtkX + gap;

    el.attacker.style.left = currentAtkX + 'px';
    el.defender.style.left = currentDefX + 'px';

    if (currentAtkX > stageWidth * 0.5) {
        const cameraOffset = (stageWidth * 0.5) - currentAtkX;
        el.stageWrapper.style.transform = `translateX(${cameraOffset}px)`;
    } else {
        el.stageWrapper.style.transform = `translateX(0px)`;
    }
}
 
/* ---------------------------------------------------------
   CORE LOGIC & HOOKS
--------------------------------------------------------- */
function renderTimePills(){
  el.timeSelector.innerHTML = "";
  TIME_OPTIONS.forEach(t => {
    const btn = document.createElement('button');
    btn.textContent = t + "s";
    btn.className = "time-pill px-3 py-1.5 rounded-md border border-[var(--hairline)] text-[var(--muted)]" +
      (t === state.selectedTime ? " active" : "");
    btn.addEventListener('click', () => {
      if (state.started && !state.finished) return; 
      state.selectedTime = t;
      restartCurrentRound();
    });
    el.timeSelector.appendChild(btn);
  });
}
 
function pickParagraph(){
  return PARAGRAPHS[Math.floor(Math.random() * PARAGRAPHS.length)];
}

/* ---------------------------------------------------------
   RANDOM PARAGRAPH API
   Pulls a random passage from the Quotable API (no key required).
   Falls back to the local PARAGRAPHS pool if the request fails, times
   out, or returns something too short/malformed to type against --
   the game should never get stuck waiting on a flaky network call.
--------------------------------------------------------- */
async function fetchRandomParagraph(){
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(
      'https://api.quotable.io/quotes/random?minLength=180&maxLength=320&limit=1',
      { signal: controller.signal }
    );
    if (!res.ok) throw new Error('bad response: ' + res.status);
    const data = await res.json();
    const text = data && data[0] && data[0].content;
    if (typeof text === 'string' && text.length > 60) return text;
    throw new Error('unexpected/short API response');
  } catch (err) {
    console.warn('Falling back to a local paragraph:', err);
    return pickParagraph();
  } finally {
    clearTimeout(timeout);
  }
}
 
function renderText(){
  el.textDisplay.innerHTML = "";
  const frag = document.createDocumentFragment();
  state.currentText.split("").forEach((ch, i) => {
    const span = document.createElement('span');
    span.textContent = ch;
    span.dataset.index = i;
    span.className = "char-pending";
    frag.appendChild(span);
  });
  el.textDisplay.appendChild(frag);
  updateCurrentCharMarker();
}
 
function updateCurrentCharMarker(){
  const spans = el.textDisplay.children;
  const idx = state.typedChars.length;
  Array.from(spans).forEach(s => s.classList.remove('char-current'));
  if (spans[idx]) spans[idx].classList.add('char-current');
  
  updateStageProgression(idx, state.currentText.length);
}
 
function startTimer(){
  state.started = true;
  state.timerId = setInterval(() => {
    state.timeLeft -= 1;
    el.timerDisplay.textContent = state.timeLeft;
    updateLiveStats();
    if (state.timeLeft <= 0){
      finishTest();
    }
  }, 1000);
}
 
function computeElapsedMinutes(){
  const elapsedSeconds = state.selectedTime - state.timeLeft;
  return Math.max(elapsedSeconds, 1) / 60; 
}
 
function updateLiveStats(){
  const minutes = computeElapsedMinutes();
  const wpm = Math.round((state.totalTyped / 5) / minutes);
  const acc = state.totalTyped > 0
    ? Math.round((state.totalCorrect / state.totalTyped) * 100)
    : 100;
  el.liveWpm.textContent = isFinite(wpm) && wpm > 0 ? wpm : 0;
  el.liveAcc.textContent = acc;
}
 
function handleKeydown(e){
  if (!ARENA_MODES.includes(currentMode)) return;
  if (state.finished) return;
 
  if (e.key === 'Tab'){
    state.tabPressed = true;
    e.preventDefault();
    return;
  }
  if (e.key === 'Enter' && state.tabPressed){
    restartCurrentRound();
    return;
  }
  if (e.key !== 'Tab') state.tabPressed = false;
 
  if (e.key === 'Backspace'){
    e.preventDefault();
    if (state.typedChars.length > 0){
      const removed = state.typedChars.pop();
      state.totalTyped -= 1;
      if (removed.correct) state.totalCorrect -= 1;
      else state.totalErrors -= 1;
      const spans = el.textDisplay.children;
      const idx = state.typedChars.length;
      spans[idx].className = "char-pending";
      updateCurrentCharMarker();
      updateLiveStats();
    }
    return;
  }
 
  if (e.key.length !== 1) return;
  e.preventDefault();
 
  if (!state.currentText) return; // paragraph still loading — ignore keystrokes, don't start the clock
  if (!state.started) startTimer();
 
  const idx = state.typedChars.length;
  if (idx >= state.currentText.length) return; 
 
  const expected = state.currentText[idx];
  const isCorrect = e.key === expected;
 
  state.typedChars.push({ char: e.key, correct: isCorrect });
  state.totalTyped += 1;
  if (isCorrect){
    state.totalCorrect += 1;
  } else {
    state.totalErrors += 1;
  }
 
  const span = el.textDisplay.children[idx];
  span.className = isCorrect ? "char-correct" : "char-incorrect";
 
  updateCurrentCharMarker();
  updateLiveStats();
 
  if (isCorrect){
    triggerAttack();
  } else {
    triggerMiss();
  }
 
  const reachedEnd = state.typedChars.length >= state.currentText.length;
  if (reachedEnd){
    finishTest();
  }
}
 
/* ---------------------------------------------------------
   AI MODE: simulated bot opponent
   The bot "types" the same paragraph at a randomized target WPM,
   ticking on a timer independent of the player's own keystrokes.
   Every character it crosses lands a hit -- reusing the exact same
   attack classes as the player, just applied to the defender instead
   of the attacker, with the mirror wrapper handling the visual flip.
--------------------------------------------------------- */
function triggerBotAttack(){
  const type = ATTACK_TYPES[botCharsTyped % ATTACK_TYPES.length];
  clearTimeout(botActionTimeout);
  el.defender.classList.remove(...ATTACK_TYPES);
  pulse(el.defender, type);
  botActionTimeout = setTimeout(() => {
    el.defender.classList.remove(type);
  }, ATTACK_DURATIONS[type]);

  // attacker takes the hit, knocked back to the LEFT (negative, away
  // from the defender) -- mirrors the positive/rightward knockback
  // the defender takes when the player lands a hit
  const kb = Math.min(12 + botCharsTyped * 0.4, 30);
  el.attacker.style.setProperty('--kb', (-kb).toFixed(1) + 'px');
  pulse(el.attacker, 'state-hit');
}

function botTick(){
  if (state.finished || currentMode !== 'battle-ai'){
    clearInterval(botTimerId);
    return;
  }
  const elapsedMin = (performance.now() - botStartTime) / 60000;
  const total = state.currentText.length;
  const targetChars = Math.floor(botTargetWpm * 5 * elapsedMin);
  const newCount = Math.min(targetChars, total);

  while (botCharsTyped < newCount){
    botCharsTyped += 1;
    triggerBotAttack();
  }

  const liveWpm = elapsedMin > 0 ? Math.round((botCharsTyped / 5) / elapsedMin) : 0;
  el.botWpm.textContent = isFinite(liveWpm) ? liveWpm : 0;

  if (botCharsTyped >= total && total > 0){
    clearInterval(botTimerId);
    if (!state.finished) finishTest();
  }
}

async function startAIRound(){
  botTargetWpm = 40 + Math.floor(Math.random() * 30); // 40-69 wpm, randomized per round
  botCharsTyped = 0;
  el.botWpm.textContent = 0;
  await resetTest();
  if (currentMode !== 'battle-ai') return; // left the screen while the paragraph was loading
  botStartTime = performance.now();
  clearInterval(botTimerId);
  botTimerId = setInterval(botTick, 150);
}

/* ---------------------------------------------------------
   PVP MODE: local hot-seat, two sequential rounds
--------------------------------------------------------- */
async function startPVPRound(){
  el.pvpTurnBanner.textContent = pvpRound === 1 ? "Player 1's turn" : "Player 2's turn";
  if (pvpRound === 1){
    await resetTest();
    pvpSharedParagraph = state.currentText; // stash so round 2 gets the identical text
  } else {
    await resetTest(pvpSharedParagraph);
  }
}

function showBattleResult({ leftLabel, leftWpm, leftAcc, rightLabel, rightWpm, rightAcc }){
  el.battleLeftLabel.textContent = leftLabel;
  el.battleLeftWpm.textContent = leftWpm;
  el.battleLeftAcc.textContent = `${leftAcc}% acc`;
  el.battleRightLabel.textContent = rightLabel;
  el.battleRightWpm.textContent = rightWpm;
  el.battleRightAcc.textContent = `${rightAcc}% acc`;

  el.battleWinnerBanner.textContent =
    leftWpm === rightWpm ? "It's a tie!" : (leftWpm > rightWpm ? `${leftLabel} wins!` : `${rightLabel} wins!`);

  showScreen('battle-result');
}

function finishTest(){
  if (state.finished) return;
  state.finished = true;
  clearInterval(state.timerId);
  clearInterval(botTimerId);
  
  clearTimeout(actionTimeout);
  clearTimeout(botActionTimeout);
  el.attacker.classList.remove(...ATTACK_TYPES, 'state-miss', 'state-hit', 'lunge-step');
  el.defender.classList.remove(...ATTACK_TYPES, 'state-hit', 'state-gloat');
  el.attacker.classList.add('pose-clash');
  el.defender.classList.add('pose-clash');
 
  const minutes = computeElapsedMinutes();
  const finalWpm = Math.round((state.totalTyped / 5) / minutes);
  const finalAcc = state.totalTyped > 0
    ? Math.round((state.totalCorrect / state.totalTyped) * 100)
    : 100;
  const roundedWpm = isFinite(finalWpm) && finalWpm > 0 ? finalWpm : 0;

  if (currentMode === 'normal'){
    el.finalWpm.textContent = roundedWpm;
    el.finalAcc.textContent = finalAcc;
    el.finalErrors.textContent = state.totalErrors;
    el.finalChars.textContent = state.totalTyped;
    el.resultMeta.textContent = `${state.selectedTime}s test`;
    el.typingCard.classList.add('hidden');
    el.resultsCard.classList.remove('hidden');
    return;
  }

  if (currentMode === 'battle-ai'){
    const botElapsedMin = (performance.now() - botStartTime) / 60000;
    const botWpmFinal = botElapsedMin > 0 ? Math.round((botCharsTyped / 5) / botElapsedMin) : 0;
    showBattleResult({
      leftLabel: 'You', leftWpm: roundedWpm, leftAcc: finalAcc,
      rightLabel: 'Bot', rightWpm: botWpmFinal, rightAcc: 98,
    });
    return;
  }

  if (currentMode === 'battle-pvp'){
    if (pvpRound === 1){
      pvpP1Stats = { wpm: roundedWpm, acc: finalAcc };
      showScreen('battle-interstitial');
    } else {
      showBattleResult({
        leftLabel: 'Player 1', leftWpm: pvpP1Stats.wpm, leftAcc: pvpP1Stats.acc,
        rightLabel: 'Player 2', rightWpm: roundedWpm, rightAcc: finalAcc,
      });
    }
    return;
  }
}
 
let resetGeneration = 0; // guards against a slow fetch resolving after a newer reset

async function resetTest(forcedText){
  const myGeneration = ++resetGeneration;
  clearInterval(state.timerId);
  clearInterval(botTimerId);
  clearTimeout(botActionTimeout);
  state = {
    selectedTime: state.selectedTime,
    timeLeft: state.selectedTime,
    timerId: null,
    started: false,
    finished: false,
    currentText: "", // loads in below; empty string safely no-ops any keystroke until then
    typedChars: [],
    totalTyped: 0,
    totalCorrect: 0,
    totalErrors: 0,
    tabPressed: false,
  };
 
  el.timerDisplay.textContent = state.timeLeft;
  el.liveWpm.textContent = 0;
  el.liveAcc.textContent = 100;
  el.carriage.style.left = "0%";
 
  el.resultsCard.classList.add('hidden');
  el.typingCard.classList.remove('hidden');
 
  hitCount = 0;
  combo = 0;
  botCharsTyped = 0;
  el.botWpm.textContent = 0;
  clearTimeout(actionTimeout);
  el.hitCount.textContent = 0;
  el.comboCount.textContent = 0;
  el.comboBadge.classList.add('hidden-badge');
  
  el.stageWrapper.style.transform = `translateX(0px)`;
  el.attacker.style.left = '60px';
  el.defender.style.left = '180px';
  el.defender.style.setProperty('--kb', '0px');
  
  el.attacker.classList.remove('state-miss', 'state-hit', 'lunge-step', 'pose-clash', ...ATTACK_TYPES);
  el.defender.classList.remove('state-hit', 'state-gloat', 'pose-clash', ...ATTACK_TYPES);
  el.spark.classList.remove('spark-show');
 
  renderTimePills();

  if (forcedText){
    // reuse an exact paragraph (PVP round 2 needs the same text Player 1 got, for a fair comparison)
    state.currentText = forcedText;
    el.textDisplay.className = 'mono text-lg md:text-2xl leading-relaxed md:leading-loose tracking-wide select-none';
    el.textDisplay.style.letterSpacing = '0.02em';
    renderText();
    focusInput();
    return;
  }

  el.textDisplay.textContent = 'Loading a fresh paragraph...';
  el.textDisplay.className = 'mono text-lg md:text-2xl leading-relaxed md:leading-loose tracking-wide select-none text-[var(--muted)]';

  const text = await fetchRandomParagraph();
  if (myGeneration !== resetGeneration) return; // superseded by a newer reset -- drop this result

  state.currentText = text;
  el.textDisplay.className = 'mono text-lg md:text-2xl leading-relaxed md:leading-loose tracking-wide select-none';
  el.textDisplay.style.letterSpacing = '0.02em';
  renderText();
  focusInput();
}
 
function focusInput(){
  if (!ARENA_MODES.includes(currentMode)) return;
  el.hiddenInput.focus({ preventScroll: true });
}

/* ---------------------------------------------------------
   MODE SWITCHING
--------------------------------------------------------- */
const ALL_SCREENS = [
  'modeSelectScreen', 'normalModeScreen', 'battleModeScreen',
  'pvpInterstitialScreen', 'battleResultScreen',
];

function showScreen(mode){
  currentMode = mode;

  const screenForMode = {
    menu: 'modeSelectScreen',
    normal: 'normalModeScreen',
    'battle-select': 'battleModeScreen',
    'battle-ai': 'normalModeScreen',
    'battle-pvp': 'normalModeScreen',
    'battle-interstitial': 'pvpInterstitialScreen',
    'battle-result': 'battleResultScreen',
  };

  ALL_SCREENS.forEach(id => el[id].classList.add('hidden'));
  const target = screenForMode[mode];
  if (target) el[target].classList.remove('hidden');

  // the arena is shared across normal/AI/PVP -- toggle its mode-specific bits
  el.pvpTurnBanner.classList.toggle('hidden', mode !== 'battle-pvp');
  el.opponentStat.classList.toggle('hidden', mode !== 'battle-ai');
  el.backToMenuBtn.textContent = (mode === 'battle-ai' || mode === 'battle-pvp') ? '← battle menu' : '← menu';
}

function restartCurrentRound(){
  if (currentMode === 'battle-ai'){ startAIRound(); return; }
  if (currentMode === 'battle-pvp'){ pvpRound = 1; pvpP1Stats = null; startPVPRound(); return; }
  resetTest();
}

function enterNormalMode(){
  showScreen('normal');
  resetTest(); // fresh test + fresh duel scene every time Normal Mode is opened
}

function enterBattleSelect(){
  showScreen('battle-select');
}

function enterBattleAI(){
  lastBattleVariant = 'ai';
  showScreen('battle-ai');
  startAIRound();
}

function enterBattlePVP(){
  lastBattleVariant = 'pvp';
  pvpRound = 1;
  pvpP1Stats = null;
  showScreen('battle-pvp');
  startPVPRound();
}

function returnFromArena(){
  // stop any running test/timer/bot loop if leaving mid-round, so nothing
  // keeps ticking or firing keydown-driven combat logic in the background
  clearInterval(state.timerId);
  clearInterval(botTimerId);
  state.finished = true;
  if (currentMode === 'battle-ai' || currentMode === 'battle-pvp'){
    showScreen('battle-select');
  } else {
    showScreen('menu');
  }
}

function goToTopMenu(){
  clearInterval(state.timerId);
  clearInterval(botTimerId);
  state.finished = true;
  showScreen('menu');
}

/* ---------------------------------------------------------
   WIRE UP
--------------------------------------------------------- */
document.addEventListener('keydown', handleKeydown);
document.addEventListener('click', focusInput);
el.restartBtn.addEventListener('click', restartCurrentRound);
el.tryAgainBtn.addEventListener('click', restartCurrentRound);

el.selectNormalBtn.addEventListener('click', enterNormalMode);
el.selectBattleBtn.addEventListener('click', enterBattleSelect);
el.backToMenuBtn.addEventListener('click', returnFromArena);
el.backFromBattleBtn.addEventListener('click', goToTopMenu);

el.selectAiBtn.addEventListener('click', enterBattleAI);
el.selectPvpBtn.addEventListener('click', enterBattlePVP);

el.startPvpRound2Btn.addEventListener('click', () => {
  pvpRound = 2;
  showScreen('battle-pvp');
  startPVPRound();
});

el.battleRematchBtn.addEventListener('click', () => {
  if (lastBattleVariant === 'ai') enterBattleAI();
  else if (lastBattleVariant === 'pvp') enterBattlePVP();
});
el.backFromBattleResultBtn.addEventListener('click', goToTopMenu);

el.hiddenInput.addEventListener('blur', () => {
  if (ARENA_MODES.includes(currentMode) && !state.finished) setTimeout(focusInput, 10);
});

showScreen('menu');