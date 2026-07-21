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
};
 
let hitCount = 0;
let combo = 0;
let actionTimeout = null;

const ATTACK_TYPES = ['atk-thrust', 'atk-crosscut', 'atk-slash'];
const ATTACK_DURATIONS = { 'atk-thrust': 160, 'atk-crosscut': 180, 'atk-slash': 180 };
 
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
      resetTest();
    });
    el.timeSelector.appendChild(btn);
  });
}
 
function pickParagraph(){
  return PARAGRAPHS[Math.floor(Math.random() * PARAGRAPHS.length)];
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
  if (state.finished) return;
 
  if (e.key === 'Tab'){
    state.tabPressed = true;
    e.preventDefault();
    return;
  }
  if (e.key === 'Enter' && state.tabPressed){
    resetTest();
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
 
function finishTest(){
  if (state.finished) return;
  state.finished = true;
  clearInterval(state.timerId);
  
  clearTimeout(actionTimeout);
  el.attacker.classList.remove(...ATTACK_TYPES, 'state-miss', 'lunge-step');
  el.defender.classList.remove('state-hit', 'state-gloat');
  el.attacker.classList.add('pose-clash');
  el.defender.classList.add('pose-clash');
 
  const minutes = computeElapsedMinutes();
  const finalWpm = Math.round((state.totalTyped / 5) / minutes);
  const finalAcc = state.totalTyped > 0
    ? Math.round((state.totalCorrect / state.totalTyped) * 100)
    : 100;
 
  el.finalWpm.textContent = isFinite(finalWpm) && finalWpm > 0 ? finalWpm : 0;
  el.finalAcc.textContent = finalAcc;
  el.finalErrors.textContent = state.totalErrors;
  el.finalChars.textContent = state.totalTyped;
  el.resultMeta.textContent = `${state.selectedTime}s test`;
 
  el.typingCard.classList.add('hidden');
  el.resultsCard.classList.remove('hidden');
}
 
function resetTest(){
  clearInterval(state.timerId);
  state = {
    selectedTime: state.selectedTime,
    timeLeft: state.selectedTime,
    timerId: null,
    started: false,
    finished: false,
    currentText: pickParagraph(),
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
  clearTimeout(actionTimeout);
  el.hitCount.textContent = 0;
  el.comboCount.textContent = 0;
  el.comboBadge.classList.add('hidden-badge');
  
  el.stageWrapper.style.transform = `translateX(0px)`;
  el.attacker.style.left = '60px';
  el.defender.style.left = '180px';
  el.defender.style.setProperty('--kb', '0px');
  
  el.attacker.classList.remove('state-miss', 'lunge-step', 'pose-clash', ...ATTACK_TYPES);
  el.defender.classList.remove('state-hit', 'state-gloat', 'pose-clash');
  el.spark.classList.remove('spark-show');
 
  renderTimePills();
  renderText();
  focusInput();
}
 
function focusInput(){
  el.hiddenInput.focus({ preventScroll: true });
}
 
/* ---------------------------------------------------------
   WIRE UP
--------------------------------------------------------- */
document.addEventListener('keydown', handleKeydown);
document.addEventListener('click', focusInput);
el.restartBtn.addEventListener('click', resetTest);
el.tryAgainBtn.addEventListener('click', resetTest);
 
el.hiddenInput.addEventListener('blur', () => {
  if (!state.finished) setTimeout(focusInput, 10);
});
 
resetTest();