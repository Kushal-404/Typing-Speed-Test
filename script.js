/* ---------------------------------------------------------
   AUDIO
--------------------------------------------------------- */
// Referencing the exact file from an external folder as requested
const mistypeSound = new Audio(
  `${import.meta.env.BASE_URL}sounds/Bruh.mp3`
);

mistypeSound.preload = 'auto';
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
let currentMode = 'menu'; // 'menu' | 'normal' | 'battle-select' | 'battle-ai' | 'battle-pvp' | 'battle-pvp-online' | 'pvp-select' | 'friend-lobby' | 'battle-interstitial' | 'battle-result'
const ARENA_MODES = ['normal', 'battle-ai', 'battle-pvp', 'battle-pvp-online']; // modes where the typing arena is live and listening

let lastBattleVariant = null; // 'ai' | 'pvp' — remembered for the Rematch button

// PVP covers two distinct implementations (local hot-seat vs online friend
// lobby) that share all the same HP/damage/3-lives combat logic -- this
// helper is what lets applyDamage() etc. treat them identically.
function isPvpMode(mode){
  return mode === 'battle-pvp' || mode === 'battle-pvp-online';
}

// AI Mode: simulated bot opponent
let botTimerId = null;
let botCharsTyped = 0;
let botStartTime = 0;
let botTargetWpm = 0;

// PVP Mode (local): hot-seat, two sequential rounds on the same paragraph
let pvpRound = 1;
let pvpSharedParagraph = '';
let pvpP1Stats = null;

/* ---------------------------------------------------------
   PVP MODE (online): Play with Friend, via a Supabase Realtime
   Broadcast + Presence channel named after the lobby code. No
   database table needed -- these are ephemeral pub/sub channels.

   FILL IN YOUR OWN PROJECT CREDENTIALS BELOW. Both values are from
   Supabase project settings -> API. The anon/public key is safe to
   expose client-side by design (it's rate-limited and has no admin
   rights) -- it is NOT a secret key.
--------------------------------------------------------- */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseClient = null;
try {
  if (window.supabase && SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY){
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (err){
  console.warn('Supabase client not initialized -- Play with Friend will be unavailable until credentials are set.', err);
}

let lobbyChannel = null;
let lobbyCode = '';
let isLobbyHost = false;
let onlineOwnStats = null;
let onlineOpponentStats = null;
let onlineOpponentPresent = false;

let state = {
  selectedTime: DEFAULT_TIME,
  timeLeft: DEFAULT_TIME,
  timerId: null,
  started: false,
  finished: false,
  startTimestamp: null, // precise wall-clock reference for WPM, set the moment typing begins
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
  hitFlash: document.getElementById('hitFlash'),
  spark: document.getElementById('spark'),
  normalHitCounter: document.getElementById('normalHitCounter'),
  hitCount: document.getElementById('hitCount'),
  battleHpBars: document.getElementById('battleHpBars'),
  attackerHpFill: document.getElementById('attackerHpFill'),
  attackerHpText: document.getElementById('attackerHpText'),
  defenderHpFill: document.getElementById('defenderHpFill'),
  defenderHpText: document.getElementById('defenderHpText'),
  pvpLivesIndicator: document.getElementById('pvpLivesIndicator'),
  myLivesIndicator: document.getElementById('myLivesIndicator'),
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

  pvpSubSelectScreen: document.getElementById('pvpSubSelectScreen'),
  selectLocalPvpBtn: document.getElementById('selectLocalPvpBtn'),
  selectFriendPvpBtn: document.getElementById('selectFriendPvpBtn'),
  selectRandomPvpBtn: document.getElementById('selectRandomPvpBtn'),
  backFromPvpSubSelectBtn: document.getElementById('backFromPvpSubSelectBtn'),

  friendLobbyScreen: document.getElementById('friendLobbyScreen'),
  lobbyChooseView: document.getElementById('lobbyChooseView'),
  lobbyWaitingView: document.getElementById('lobbyWaitingView'),
  lobbyResultWaitView: document.getElementById('lobbyResultWaitView'),
  createLobbyBtn: document.getElementById('createLobbyBtn'),
  joinLobbyInput: document.getElementById('joinLobbyInput'),
  joinLobbyBtn: document.getElementById('joinLobbyBtn'),
  lobbyCodeDisplay: document.getElementById('lobbyCodeDisplay'),
  lobbyStatusDot: document.getElementById('lobbyStatusDot'),
  lobbyStatusText: document.getElementById('lobbyStatusText'),
  lobbyErrorText: document.getElementById('lobbyErrorText'),
  backFromFriendLobbyBtn: document.getElementById('backFromFriendLobbyBtn'),

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
 
let hitCount = 0; // still drives ATTACK_TYPES cycling; no longer displayed directly
let combo = 0;
let missTimeoutId = null; // strips the miss pose; separate from the attack swing timers in combatTimers
let consecutiveMisses = 0;

/* ---------------------------------------------------------
   HP / DAMAGE SYSTEM
   "Your typing skill is your fighting skill": damage scales with
   accuracy and combo, so better typing directly produces a stronger
   fighter. koTriggered is a synchronous guard set the instant HP
   crosses zero -- separate from state.finished, which only flips
   after the delayed result transition. Without this separate flag,
   the bot's 150ms tick loop (or a fast typist landing several hits
   in the same frame) can cross the KO threshold more than once
   before the first KO's delayed finish fires, double-triggering the
   end-of-round flow. That double-trigger is the most likely cause of
   the "broken in every mode" bug from the previous attempt, since
   every mode shares this same finish path.
--------------------------------------------------------- */
const HP_MAX = 100;
const KO_RESULT_DELAY = 700; // ms -- lets the finishing hit's animation play before cutting to results
const MISS_PUNISH_THRESHOLD = 3; // consecutive mistakes before the AI bot gets a free punish hit
// Attacking power reduced 80% from the original formula per user request --
// fights were ending too fast. Both sides' base damage is scaled by 0.2.
const DAMAGE_SCALE = 0.2;
const BOT_HIT_DAMAGE = 8 * DAMAGE_SCALE;
const PVP_LIVES = 3; // PVP: the defender's HP bar must be fully depleted this many times to win outright

let attackerHP = HP_MAX;
let defenderHP = HP_MAX;
let koTriggered = false;
let koResultTimeoutId = null; // tracks the pending delayed finish so it can be cancelled if the player navigates away mid-delay
let defenderLivesRemaining = PVP_LIVES; // PVP only -- how many bars are left on MY opponent
let myLivesRemaining = PVP_LIVES; // online PVP only -- how many bars are left on ME
let pvpDamageDealt = 0; // PVP only -- cumulative damage this player's turn, used as the tiebreaker if time runs out before 3 bars are depleted

function currentAccuracyPct(){
  return state.totalTyped > 0 ? (state.totalCorrect / state.totalTyped) * 100 : 100;
}

// Higher accuracy -> stronger hits; higher combo -> stronger hits.
// A mistake immediately weakens the next few hits by resetting combo
// and dragging accuracy down, without needing extra punishment logic.
function playerDamage(){
  const acc = currentAccuracyPct();
  const accuracyMultiplier = 0.6 + (acc / 100) * 0.6; // 60% dmg at 0% acc -> 120% dmg at 100% acc
  const comboBonus = Math.min(combo * 0.6, 10);
  const raw = (8 + comboBonus) * accuracyMultiplier * DAMAGE_SCALE;
  return Math.max(1, Math.round(raw)); // floor of 1 so a correct hit always registers something
}

function updateHpBar(fillEl, textEl, hp){
  const pct = Math.max(0, Math.min(100, hp));
  fillEl.style.width = pct + '%';
  textEl.textContent = Math.round(pct);
  fillEl.classList.toggle('low', pct > 0 && pct <= 25); // pulse warning
  fillEl.classList.toggle('hp-mid', pct > 0 && pct <= 50 && pct > 20);
  fillEl.classList.toggle('hp-low', pct > 0 && pct <= 20);
}

function updatePvpLivesIndicator(){
  const pips = el.pvpLivesIndicator.querySelectorAll('.pvp-life');
  pips.forEach((pip, i) => {
    pip.classList.toggle('spent', i >= defenderLivesRemaining);
  });
}

function updateMyLivesIndicator(){
  if (!el.myLivesIndicator) return;
  const pips = el.myLivesIndicator.querySelectorAll('.pvp-life');
  pips.forEach((pip, i) => {
    pip.classList.toggle('spent', i >= myLivesRemaining);
  });
}

// Single choke point for all damage -- both triggerAttack (player hits
// defender) and triggerBotAttack (bot hits attacker) route through
// this, so HP clamping and the KO guard only need to live in one place.
// PVP mode adds a wrinkle: the defender's bar has to be fully drained
// PVP_LIVES times before the round actually ends -- draining it once
// just refills it and keeps the same round/timer running.
function applyDamage(target, amount){
  if (koTriggered) return;
  if (target === 'defender'){
    defenderHP = Math.max(0, defenderHP - amount);
    updateHpBar(el.defenderHpFill, el.defenderHpText, defenderHP);
    if (isPvpMode(currentMode)) pvpDamageDealt += amount;

    if (defenderHP <= 0){
      if (isPvpMode(currentMode)){
        defenderLivesRemaining -= 1;
        updatePvpLivesIndicator();
        if (defenderLivesRemaining > 0){
          defenderHP = HP_MAX; // one bar down, refill and keep the same round going
          updateHpBar(el.defenderHpFill, el.defenderHpText, defenderHP);
        } else {
          triggerKO('attacker'); // all three bars depleted -- decisive win
        }
      } else {
        triggerKO('attacker'); // AI mode (Normal Mode never reaches here -- damage is gated off there)
      }
    }
  } else {
    attackerHP = Math.max(0, attackerHP - amount);
    updateHpBar(el.attackerHpFill, el.attackerHpText, attackerHP);

    if (attackerHP <= 0){
      if (currentMode === 'battle-pvp-online'){
        // symmetric to the defender branch above: online PVP needs the
        // attacker side to survive PVP_LIVES hits too, since a real
        // opponent (not a one-hit-KO bot) is dealing this damage
        myLivesRemaining -= 1;
        updateMyLivesIndicator();
        if (myLivesRemaining > 0){
          attackerHP = HP_MAX;
          updateHpBar(el.attackerHpFill, el.attackerHpText, attackerHP);
        } else {
          triggerKO('defender'); // opponent depleted all three of my bars -- they win
        }
      } else {
        triggerKO('defender'); // AI mode -- one bar, one hit ends it
      }
    }
  }
}

// winnerSide: 'attacker' (player landed the finishing blow) or
// 'defender' (the bot did, AI Mode only). Stops the bot immediately
// so it can't land further hits during the delay, freezes input via
// state.koPending, then waits KO_RESULT_DELAY before actually ending
// the round so the last animation isn't cut off mid-swing.
function triggerKO(winnerSide){
  if (koTriggered) return; // hard stop -- this is what prevents the double-fire race
  koTriggered = true;
  state.koPending = true;
  clearInterval(botTimerId);
  koResultTimeoutId = setTimeout(() => {
    finishRoundKO(winnerSide);
  }, KO_RESULT_DELAY);
}

const ATTACK_TYPES = ['atk-thrust', 'atk-crosscut', 'atk-kick', 'atk-slash'];
const ATTACK_DURATIONS = { 'atk-thrust': 160, 'atk-crosscut': 180, 'atk-kick': 200, 'atk-slash': 180 };
// The exact point (0-1) along each swing's own timeline where the blade
// (or kicking foot) actually connects -- matches the impact keyframe
// already built into that attack's CSS animation (thrustArm/crossArm/
// snapKickUpper/slashArmU). Every impact-synced effect below fires off
// of this, never at swing-start, so nothing lands before visual contact.
const ATTACK_IMPACT_AT = { 'atk-thrust': 0.46, 'atk-crosscut': 0.50, 'atk-kick': 0.45, 'atk-slash': 0.58 };
// Hit-stop length per attack type, in ms -- 2-6 frames at 60fps (33-100ms).
// Scaled to each attack's weight: the fast thrust stays snappy so
// combo flow never feels sluggish, while the heavier overhead slash
// gets a slightly longer beat to sell its impact.
const HITSTOP_MS = { 'atk-thrust': 40, 'atk-crosscut': 50, 'atk-kick': 55, 'atk-slash': 65 };
// Camera shake per attack type: `x` is the horizontal shake distance in
// px (also doubles as the punch-in strength via --shake-mag below),
// `mag` scales the punch/vertical jitter. Light, fast attacks (thrust)
// stay subtle; heavier attacks (slash) hit the camera harder.
const CAMERA_SHAKE = {
  'atk-thrust':   { x: 3, mag: 1   },
  'atk-crosscut': { x: 4, mag: 1.2 },
  'atk-kick':     { x: 5, mag: 1.4 },
  'atk-slash':    { x: 6, mag: 1.7 },
};
 
/* ---------------------------------------------------------
   COMBAT ENGINE
--------------------------------------------------------- */
// Per-fighter timer registry: 'strip' clears the attack class once the
// swing animation finishes, 'impact' fires the impact-frame effects.
// Keeping these separate per actor (rather than one shared variable)
// means the player's swing timers and the opponent's never race or
// clobber each other.
const combatTimers = {
  attacker: { strip: null, impact: null, blend: null },
  defender: { strip: null, impact: null, blend: null },
};

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

// Hit pause: briefly freezes every running combat animation right on
// the impact frame. Pure timing -- pauses/resumes playback, doesn't
// change what any animation looks like.
let hitStopTimeoutId = null;
function triggerHitPause(ms){
  clearTimeout(hitStopTimeoutId);
  el.duelContainer.classList.add('hit-stop');
  hitStopTimeoutId = setTimeout(() => {
    el.duelContainer.classList.remove('hit-stop');
  }, ms);
}

function clearAllCombatTimers(){
  Object.values(combatTimers).forEach(t => {
    clearTimeout(t.strip); clearTimeout(t.impact); clearTimeout(t.blend);
  });
  clearTimeout(hitStopTimeoutId);
  clearTimeout(missTimeoutId);
  el.duelContainer.classList.remove('hit-stop');
  el.duelContainer.classList.remove('camera-hit');
  [el.attacker, el.defender].forEach(actorEl => {
    actorEl.querySelectorAll(BLEND_PARTS).forEach(p => { p.style.transform = ''; });
  });
}

// Camera shake + punch, directional (toward whichever fighter took the
// hit) and scaled by attack weight. Writes the direction/magnitude into
// CSS custom properties, then pulse() restarts the single camera-hit
// animation from scratch -- so a new hit always cleanly replaces the
// last shake instead of stacking a second animation instance on top of
// one still playing, which is what would turn rapid combo hits into
// chaotic, compounding jitter.
function triggerCameraHit(type, direction){
  const shake = CAMERA_SHAKE[type];
  el.duelContainer.style.setProperty('--shake-x', (direction * shake.x) + 'px');
  el.duelContainer.style.setProperty('--shake-mag', shake.mag);
  pulse(el.duelContainer, 'camera-hit');
}

// -- COMBO TRANSITION BLENDING --
// Hard-removing an in-flight attack class snaps every limb straight to
// its new animation's 0% pose in a single frame -- only visible when a
// new attack interrupts one still mid-swing (chaining faster than a
// swing's own recovery). This freezes the swinging limbs at their
// actual current (computed) pose for one short beat via inline style,
// giving the existing `.stickman div { transition: transform 120ms }`
// rule a real "before" value to bridge from before the new swing's
// animation takes over, instead of cutting straight to it. A normal,
// non-overlapping attack never touches this path and stays instant.
const BLEND_PARTS = '.torso, .head, .arm, .sword:not(.sword-ghost), .leg, .leg .lower';
const BLEND_MS = 28; // short enough to stay imperceptible as input lag, long enough for the transition to visibly soften the cut

function beginSwing(actorEl, type, footwork){
  actorEl.classList.remove(...ATTACK_TYPES);
  pulse(actorEl, type);
  if (footwork) pulse(actorEl, 'lunge-step');
}

// Starts a swing immediately -- same classes, same CSS animation, same
// duration as before -- but schedules every impact-synced effect
// (spark, hit flash, hit pause, and whatever onImpact adds: recoil/
// knockback, combo feedback, damage) to fire on that swing's actual
// impact frame instead of at swing-start. Shared by the player's own
// attacks and the opponent's (bot or remote) so both directions of
// combat land on frame-accurate timing instead of duplicating this
// scheduling logic three times.
function scheduleSwing(actorKey, actorEl, type, footwork, onImpact){
  const timers = combatTimers[actorKey];
  clearTimeout(timers.strip);
  clearTimeout(timers.blend);

  const wasSwinging = ATTACK_TYPES.some(t => actorEl.classList.contains(t));
  let startDelay = 0;

  if (wasSwinging){
    // Read each limb's current animated pose *before* touching any
    // classes, then hold it in place with an inline style so removing
    // the old attack class doesn't cause a visible jump.
    const parts = actorEl.querySelectorAll(BLEND_PARTS);
    parts.forEach(p => { p.style.transform = getComputedStyle(p).transform; });
    actorEl.classList.remove(...ATTACK_TYPES);
    startDelay = BLEND_MS;
    timers.blend = setTimeout(() => {
      parts.forEach(p => { p.style.transform = ''; });
      beginSwing(actorEl, type, footwork);
    }, startDelay);
  } else {
    beginSwing(actorEl, type, footwork);
  }

  const duration = ATTACK_DURATIONS[type];
  const impactDelay = Math.round(duration * ATTACK_IMPACT_AT[type]) + startDelay;

  clearTimeout(timers.impact);
  timers.impact = setTimeout(() => {
    positionSpark();
    pulse(el.spark, 'spark-show');
    pulse(el.hitFlash, 'hit-flash-show');

    const freeze = HITSTOP_MS[type];
    triggerHitPause(freeze);
    // Direction: the player's own attacks land to the right (toward the
    // defender), the opponent's (bot/remote) land to the left (toward
    // the attacker) -- so the shake always kicks toward whoever got hit.
    triggerCameraHit(type, actorKey === 'attacker' ? 1 : -1);
    // The pause above freezes this actor's swing animation for `freeze`
    // ms. The strip timer below was already counting down on real time,
    // so without this it would fire early relative to the now-paused
    // animation and cut the follow-through off mid-motion. Reschedule
    // it from right now for whatever time was left, plus the freeze.
    clearTimeout(timers.strip);
    timers.strip = setTimeout(() => {
      actorEl.classList.remove(type);
    }, (duration - impactDelay + startDelay) + freeze);

    onImpact();
  }, impactDelay);

  timers.strip = setTimeout(() => {
    actorEl.classList.remove(type);
  }, duration + startDelay);
}

function triggerAttack(){
  hitCount += 1;
  consecutiveMisses = 0;
  el.hitCount.textContent = hitCount;

  const type = ATTACK_TYPES[hitCount % ATTACK_TYPES.length];

  scheduleSwing('attacker', el.attacker, type, true, () => {
    // Combo feedback, enemy recoil/knockback, and damage all now land
    // on the strike frame rather than at keystroke time.
    combo += 1;
    el.comboCount.textContent = combo;
    el.comboBadge.classList.toggle('hidden-badge', combo < 8);

    const kb = Math.min(combo * 0.9, 16);
    el.defender.style.setProperty('--kb', kb + 'px');
    pulse(el.defender, 'state-hit'); // enemy recoil

    // HP/damage only exists in Battle Mode (AI + PVP) -- Normal Mode is
    // purely a typing test with visual flavor, no win/lose condition
    if (currentMode !== 'normal'){
      const dmg = playerDamage();
      applyDamage('defender', dmg);
      if (currentMode === 'battle-pvp-online'){
        // send the exact number dealt, not just a "hit happened" ping --
        // the friend's client applies this value directly rather than
        // recomputing it, so both sides can never drift out of sync
        console.log('[lobby] sending hit broadcast:', dmg);
        broadcastLobbyEvent('hit', { damage: dmg });
      }
    }
  });
}
 
function triggerMiss(){
  // --- NEW AUDIO LOGIC ---
  mistypeSound.currentTime = 0; // Rewind to start so rapid mistypes overlap correctly
  mistypeSound.play().catch(err => console.warn('Audio playback prevented by browser:', err));
  // -----------------------

  combo = 0;
  el.comboCount.textContent = 0;
  el.comboBadge.classList.add('hidden-badge');
  clearTimeout(combatTimers.attacker.strip);
  clearTimeout(missTimeoutId);
  el.attacker.classList.remove(...ATTACK_TYPES);
  pulse(el.attacker, 'state-miss');
  pulse(el.defender, 'state-gloat');

  missTimeoutId = setTimeout(() => {
    el.attacker.classList.remove('state-miss');
  }, 250);

  // AI Mode only: string together enough mistakes in a row and the
  // bot gets a free punish hit -- reuses the bot's own attack (visual
  // + damage) rather than duplicating that logic here
  if (currentMode === 'battle-ai' && !koTriggered){
    consecutiveMisses += 1;
    if (consecutiveMisses >= MISS_PUNISH_THRESHOLD){
      consecutiveMisses = 0;
      triggerBotAttack();
    }
  }
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
 
/* ---------------------------------------------------------
   CONTINUOUS PARAGRAPH FLOW
   Finishing the current paragraph before time runs out loads the next
   one automatically instead of ending the round. The next paragraph
   is fetched in the background well before it's needed, so there's no
   visible pause when it's appended -- if the fetch somehow hasn't
   resolved yet, a local paragraph is used instantly as a fallback
   (network fetches are never on the critical path for continuing).
--------------------------------------------------------- */
let preloadedNextText = null;
let preloadInFlight = false;
let paragraphSegmentStart = 0; // where the CURRENT paragraph segment begins within state.currentText -- keeps the duel progress bar showing per-paragraph progress instead of shrinking every time more text is appended

async function preloadNextParagraph(){
  if (preloadInFlight || preloadedNextText) return;
  preloadInFlight = true;
  const text = await fetchRandomParagraph();
  preloadedNextText = text;
  preloadInFlight = false;
}

function takePreloadedText(){
  if (preloadedNextText){
    const text = preloadedNextText;
    preloadedNextText = null;
    return text; // already fetched -- zero delay
  }
  return pickParagraph(); // fetch hadn't finished yet -- use a local paragraph instantly rather than making the player wait
}

function extendParagraph(){
  const nextText = takePreloadedText();
  const separator = '  ';
  const startIdx = state.currentText.length;
  const addition = separator + nextText;

  state.currentText += addition;
  paragraphSegmentStart = startIdx + separator.length;

  const frag = document.createDocumentFragment();
  addition.split('').forEach((ch, i) => {
    const span = document.createElement('span');
    span.textContent = ch;
    span.dataset.index = startIdx + i;
    span.className = "char-pending";
    frag.appendChild(span);
  });
  el.textDisplay.appendChild(frag);
  updateCurrentCharMarker();

  preloadNextParagraph(); // top up the pipeline for next time
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
  
  const segmentIdx = idx - paragraphSegmentStart;
  const segmentTotal = state.currentText.length - paragraphSegmentStart;
  updateStageProgression(segmentIdx, segmentTotal);
}
 
function startTimer(){
  state.started = true;
  state.startTimestamp = performance.now();
  state.timerId = setInterval(() => {
    state.timeLeft -= 1;
    el.timerDisplay.textContent = state.timeLeft;
    updateLiveStats();
    if (state.timeLeft <= 0 && !state.koPending){
      finishTest();
    }
  }, 1000);
}

// Single source of truth for player WPM (used by both the live display
// and the final result), so the two can never drift out of sync with
// each other. Elapsed time is measured from a precise timestamp -- not
// the once-per-second countdown display -- and, below 1 real second of
// data, there simply isn't enough signal for a per-minute extrapolation
// to be meaningful, so it reports 0 instead of projecting a noisy guess.
function calculatePlayerWpm(){
  if (state.startTimestamp == null) return 0;
  const elapsedSeconds = (performance.now() - state.startTimestamp) / 1000;
  if (elapsedSeconds < 1) return 0;
  const wpm = Math.round((state.totalCorrect / 5) / (elapsedSeconds / 60));
  return isFinite(wpm) && wpm > 0 ? wpm : 0;
}
 
function updateLiveStats(){
  const wpm = calculatePlayerWpm();
  const acc = state.totalTyped > 0
    ? Math.round((state.totalCorrect / state.totalTyped) * 100)
    : 100;
  el.liveWpm.textContent = wpm;
  el.liveAcc.textContent = acc;
}
 
// Handles ONLY the Tab+Enter restart shortcut. Deliberately does NOT
// preventDefault() on printable characters or Backspace anymore --
// doing so would suppress the browser's default text-insertion
// behavior, which is exactly what triggers the 'input' event below.
// Physical keyboards fire both keydown and input; mobile virtual
// keyboards often only fire input reliably -- so all actual game
// logic now lives in handleHiddenInput instead, to work on both.
function handleKeydown(e){
  if (!ARENA_MODES.includes(currentMode)) return;
  if (state.finished || state.koPending) return;
 
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
}

// Fires on real text-content changes to the hidden input -- reliable
// across physical keyboards AND mobile virtual keyboards, unlike
// keydown. The field is cleared after every keystroke so it never
// accumulates more than one character between reads.
// A permanently-empty field means Backspace has nothing to delete --
// deleting nothing from nothing is a no-op change, and browsers don't
// fire 'input' for a no-op, so Backspace would silently do nothing.
// Keeping one invisible sentinel character in the field at all times
// guarantees there's always something for Backspace to actually
// remove, so the event reliably fires.
const INPUT_SENTINEL = '\u200B'; // zero-width space -- invisible, never appears in real paragraph text

function resetHiddenInputBuffer(){
  el.hiddenInput.value = INPUT_SENTINEL;
  try {
    el.hiddenInput.setSelectionRange(1, 1); // cursor after the sentinel, so new characters append rather than insert before it
  } catch (err) { /* setSelectionRange can throw in rare edge cases -- harmless to ignore */ }
}

function handleHiddenInput(e){
  if (!ARENA_MODES.includes(currentMode)) return;
  if (state.finished || state.koPending) return;

  const value = el.hiddenInput.value;
  const isBackspace = value.length === 0 || e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward';

  if (isBackspace){
    resetHiddenInputBuffer();
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

  const typedChar = value.slice(-1); // the most recently typed character (appended after the sentinel)
  resetHiddenInputBuffer();
  if (!typedChar) return; // composition-only events etc with no actual character

  if (!state.currentText) return; // paragraph still loading — ignore keystrokes, don't start the clock
  if (!state.started) startTimer();

  const idx = state.typedChars.length;
  if (idx >= state.currentText.length) return;

  const expected = state.currentText[idx];
  const isCorrect = typedChar === expected;

  state.typedChars.push({ char: typedChar, correct: isCorrect });
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
  if (reachedEnd && !state.koPending){
    if (state.timeLeft > 0 && !state.finished){
      extendParagraph();
    } else {
      finishTest();
    }
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
  if (koTriggered) return; // don't play a bot attack after the round's already decided
  const type = ATTACK_TYPES[botCharsTyped % ATTACK_TYPES.length];

  scheduleSwing('defender', el.defender, type, false, () => {
    // attacker takes the hit, knocked back to the LEFT (negative, away
    // from the defender) -- mirrors the positive/rightward knockback
    // the defender takes when the player lands a hit
    const kb = Math.min(12 + botCharsTyped * 0.4, 30);
    el.attacker.style.setProperty('--kb', (-kb).toFixed(1) + 'px');
    pulse(el.attacker, 'state-hit'); // player recoil

    applyDamage('attacker', BOT_HIT_DAMAGE);
  });
}

// Online PVP: mirrors triggerBotAttack's visual pattern exactly, but is
// driven by a real hit broadcast from the friend's client instead of a
// simulated bot timer. The damage amount is transmitted rather than
// recomputed locally, so both clients always agree on the exact number.
let remoteHitsReceived = 0;

function applyRemoteHit(damage){
  if (koTriggered) return;
  remoteHitsReceived += 1;
  const type = ATTACK_TYPES[remoteHitsReceived % ATTACK_TYPES.length];

  scheduleSwing('defender', el.defender, type, false, () => {
    const kb = Math.min(12 + remoteHitsReceived * 0.4, 30);
    el.attacker.style.setProperty('--kb', (-kb).toFixed(1) + 'px');
    pulse(el.attacker, 'state-hit'); // player recoil

    applyDamage('attacker', damage);
  });
}

function botTick(){
  if (state.finished || state.koPending || currentMode !== 'battle-ai'){
    clearInterval(botTimerId);
    return;
  }
  const elapsedMin = (performance.now() - botStartTime) / 60000;
  const total = state.currentText.length;
  const targetChars = Math.floor(botTargetWpm * 5 * elapsedMin);
  const newCount = Math.min(targetChars, total);

  while (botCharsTyped < newCount && !koTriggered){
    botCharsTyped += 1;
    triggerBotAttack();
  }
  if (koTriggered){
    clearInterval(botTimerId);
    return;
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

function showBattleResult({ leftLabel, leftWpm, leftAcc, rightLabel, rightWpm, rightAcc, leftDamage, rightDamage, koSide }){
  el.battleLeftLabel.textContent = leftLabel;
  el.battleLeftWpm.textContent = leftWpm;
  el.battleRightLabel.textContent = rightLabel;
  el.battleRightWpm.textContent = rightWpm;

  // PVP shows damage dealt (the actual win condition there) instead of
  // accuracy; AI Mode keeps showing accuracy since WPM/accuracy is what
  // decides that comparison when neither side lands the finishing blow
  if (leftDamage !== undefined){
    el.battleLeftAcc.textContent = `${leftDamage} dmg dealt`;
    el.battleRightAcc.textContent = `${rightDamage} dmg dealt`;
  } else {
    el.battleLeftAcc.textContent = `${leftAcc}% acc`;
    el.battleRightAcc.textContent = `${rightAcc}% acc`;
  }

  if (koSide === 'left'){
    el.battleWinnerBanner.textContent = `${leftLabel} wins by K.O.!`;
  } else if (koSide === 'right'){
    el.battleWinnerBanner.textContent = `${rightLabel} wins by K.O.!`;
  } else if (koSide === 'tie'){
    el.battleWinnerBanner.textContent = "It's a tie!";
  } else {
    // fallback only used by AI Mode (WPM comparison) -- PVP always
    // passes an explicit koSide ('left'/'right'/'tie'), never null,
    // since its winner is decided by damage dealt, not WPM
    el.battleWinnerBanner.textContent =
      leftWpm === rightWpm ? "It's a tie!" : (leftWpm > rightWpm ? `${leftLabel} wins!` : `${rightLabel} wins!`);
  }

  showScreen('battle-result');
}

// Set by triggerKO() right before the delayed finishTest() call, so
// the branches below know whether -- and how -- this round ended in
// a knockout rather than a normal time-up/paragraph-complete finish.
let koWinnerSide = null; // 'attacker' | 'defender' | null
function finishRoundKO(side){
  koWinnerSide = side;
  finishTest();
}

function finishTest(){
  if (state.finished) return;
  state.finished = true;
  state.koPending = false;
  clearInterval(state.timerId);
  clearInterval(botTimerId);
  
  clearAllCombatTimers();
  el.hitFlash.classList.remove('hit-flash-show');
  el.attacker.classList.remove(...ATTACK_TYPES, 'state-miss', 'state-hit', 'lunge-step');
  el.defender.classList.remove(...ATTACK_TYPES, 'state-hit', 'state-gloat');
  el.attacker.classList.add('pose-clash');
  el.defender.classList.add('pose-clash');
 
  const roundedWpm = calculatePlayerWpm();
  const finalAcc = state.totalTyped > 0
    ? Math.round((state.totalCorrect / state.totalTyped) * 100)
    : 100;

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
    const koSide = koWinnerSide === 'attacker' ? 'left' : (koWinnerSide === 'defender' ? 'right' : null);
    showBattleResult({
      leftLabel: 'You', leftWpm: roundedWpm, leftAcc: finalAcc,
      rightLabel: 'Bot', rightWpm: botWpmFinal, rightAcc: 98,
      koSide,
    });
    return;
  }

  if (currentMode === 'battle-pvp'){
    const wonAllThreeBars = koWinnerSide === 'attacker'; // depleted all PVP_LIVES bars before time ran out
    const damageDealt = Math.round(pvpDamageDealt);

    if (pvpRound === 1){
      pvpP1Stats = { wpm: roundedWpm, acc: finalAcc, damage: damageDealt, wonAllThreeBars };
      showScreen('battle-interstitial');
    } else {
      const p2 = { wpm: roundedWpm, acc: finalAcc, damage: damageDealt, wonAllThreeBars };
      // Win condition: whoever depletes all 3 bars first wins outright.
      // If neither (or, in principle, both) does before time runs out,
      // whoever dealt more total damage wins; equal damage is a tie.
      let koSide;
      if (pvpP1Stats.wonAllThreeBars && !p2.wonAllThreeBars) koSide = 'left';
      else if (!pvpP1Stats.wonAllThreeBars && p2.wonAllThreeBars) koSide = 'right';
      else if (pvpP1Stats.damage === p2.damage) koSide = 'tie';
      else koSide = pvpP1Stats.damage > p2.damage ? 'left' : 'right';

      showBattleResult({
        leftLabel: 'Player 1', leftWpm: pvpP1Stats.wpm, leftDamage: pvpP1Stats.damage,
        rightLabel: 'Player 2', rightWpm: p2.wpm, rightDamage: p2.damage,
        koSide,
      });
    }
    return;
  }

  if (currentMode === 'battle-pvp-online'){
    onlineOwnStats = {
      wpm: roundedWpm,
      damage: Math.round(pvpDamageDealt),
      wonAllThreeBars: koWinnerSide === 'attacker',
    };
    broadcastLobbyEvent('result', onlineOwnStats);
    maybeShowOnlineResult(); // resolves immediately if the opponent's result already arrived first
    return;
  }
}
 
let resetGeneration = 0; // guards against a slow fetch resolving after a newer reset

async function resetTest(forcedText){
  const myGeneration = ++resetGeneration;
  clearInterval(state.timerId);
  clearInterval(botTimerId);
  clearAllCombatTimers();
  clearTimeout(koResultTimeoutId);
  paragraphSegmentStart = 0;
  preloadedNextText = null;
  preloadInFlight = false;
  state = {
    selectedTime: state.selectedTime,
    timeLeft: state.selectedTime,
    timerId: null,
    started: false,
    finished: false,
    koPending: false,
    startTimestamp: null,
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
  consecutiveMisses = 0;
  koTriggered = false;
  koWinnerSide = null;
  attackerHP = HP_MAX;
  defenderHP = HP_MAX;
  defenderLivesRemaining = PVP_LIVES;
  myLivesRemaining = PVP_LIVES;
  pvpDamageDealt = 0;
  remoteHitsReceived = 0;
  updateHpBar(el.attackerHpFill, el.attackerHpText, attackerHP);
  updateHpBar(el.defenderHpFill, el.defenderHpText, defenderHP);
  updatePvpLivesIndicator();
  updateMyLivesIndicator();
  botCharsTyped = 0;
  el.botWpm.textContent = 0;
  el.hitFlash.classList.remove('hit-flash-show');
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
    preloadNextParagraph();
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
  preloadNextParagraph();
}
 
function focusInput(){
  if (!ARENA_MODES.includes(currentMode)) return;
  el.hiddenInput.focus({ preventScroll: true });
  resetHiddenInputBuffer();
}

/* ---------------------------------------------------------
   MODE SWITCHING
--------------------------------------------------------- */
const ALL_SCREENS = [
  'modeSelectScreen', 'normalModeScreen', 'battleModeScreen',
  'pvpSubSelectScreen', 'friendLobbyScreen',
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
    'battle-pvp-online': 'normalModeScreen',
    'pvp-select': 'pvpSubSelectScreen',
    'friend-lobby': 'friendLobbyScreen',
    'battle-interstitial': 'pvpInterstitialScreen',
    'battle-result': 'battleResultScreen',
  };

  ALL_SCREENS.forEach(id => el[id].classList.add('hidden'));
  const target = screenForMode[mode];
  if (target) el[target].classList.remove('hidden');

  // the arena is shared across normal/AI/local-PVP/online-PVP -- toggle its mode-specific bits
  el.pvpTurnBanner.classList.toggle('hidden', mode !== 'battle-pvp');
  el.opponentStat.classList.toggle('hidden', mode !== 'battle-ai');
  el.battleHpBars.classList.toggle('hidden', mode !== 'battle-ai' && !isPvpMode(mode));
  el.normalHitCounter.classList.toggle('hidden', mode !== 'normal');
  el.pvpLivesIndicator.classList.toggle('hidden', !isPvpMode(mode));
  el.myLivesIndicator.classList.toggle('hidden', mode !== 'battle-pvp-online');
  el.backToMenuBtn.textContent = (mode === 'battle-ai' || isPvpMode(mode)) ? '← battle menu' : '← menu';
}

function restartCurrentRound(){
  if (currentMode === 'battle-ai'){ startAIRound(); return; }
  if (currentMode === 'battle-pvp'){ pvpRound = 1; pvpP1Stats = null; startPVPRound(); return; }
  // online PVP rounds are lobby-driven (host-authoritative), not locally restartable
  if (currentMode === 'battle-pvp-online') return;
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

function enterPvpSubSelect(){
  showScreen('pvp-select');
}

/* ---------------------------------------------------------
   ONLINE PVP: Play with Friend
   A Supabase Realtime channel named "lobby-<code>" is the whole
   backend for this feature -- Broadcast carries the shared paragraph
   and each player's final result; Presence detects when both players
   are actually in the room. The host is authoritative for paragraph
   selection (so both players are guaranteed the exact same text) and
   for deciding when the round starts.
--------------------------------------------------------- */
function generateLobbyCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O or 1/I
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function showLobbyError(msg){
  el.lobbyErrorText.textContent = msg;
  el.lobbyErrorText.classList.remove('hidden');
}

function clearLobbyError(){
  el.lobbyErrorText.classList.add('hidden');
  el.lobbyErrorText.textContent = '';
}

function setLobbyView(view){
  // view: 'choose' | 'waiting' | 'result-wait'
  el.lobbyChooseView.classList.toggle('hidden', view !== 'choose');
  el.lobbyWaitingView.classList.toggle('hidden', view !== 'waiting');
  el.lobbyResultWaitView.classList.toggle('hidden', view !== 'result-wait');
}

function enterFriendLobby(){
  clearLobbyError();
  setLobbyView('choose');
  el.joinLobbyInput.value = '';
  showScreen('friend-lobby');
}

function leaveLobby(){
  if (lobbyChannel && supabaseClient){
    supabaseClient.removeChannel(lobbyChannel);
  }
  lobbyChannel = null;
  lobbyCode = '';
  isLobbyHost = false;
  onlineOwnStats = null;
  onlineOpponentStats = null;
  onlineOpponentPresent = false;
  lobbyRoundStarted = false;
}

async function broadcastLobbyEvent(type, payload){
  if (!lobbyChannel) return;
  try {
    const status = await lobbyChannel.send({ type: 'broadcast', event: type, payload });
    if (status !== 'ok'){
      console.warn(`[lobby] broadcast "${type}" did not send cleanly, status:`, status);
    }
  } catch (err){
    console.error(`[lobby] broadcast "${type}" threw an error:`, err);
  }
}

let lobbyRoundStarted = false;

async function connectToLobby(code, asHost){
  if (!supabaseClient){
    showLobbyError('Online play needs Supabase credentials set in script.js (SUPABASE_URL / SUPABASE_ANON_KEY) first.');
    return;
  }
  clearLobbyError();
  leaveLobby(); // clean up any previous connection before starting a new one
  lobbyCode = code;
  isLobbyHost = asHost;

  const myId = Math.random().toString(36).slice(2, 10);
  const channel = supabaseClient.channel(`lobby-${code}`, {
    config: { presence: { key: myId } },
  });

  channel.on('presence', { event: 'sync' }, () => {
    const presenceState = channel.presenceState();
    const count = Object.keys(presenceState).length;
    onlineOpponentPresent = count >= 2;
    if (isLobbyHost && onlineOpponentPresent && !lobbyRoundStarted){
      lobbyRoundStarted = true;
      startOnlineLobbyRound();
    }
  });

  channel.on('presence', { event: 'leave' }, () => {
    if ((currentMode === 'friend-lobby' || currentMode === 'battle-pvp-online') && !state.finished){
      showLobbyError('Your friend disconnected.');
    }
  });

  channel.on('broadcast', { event: 'start' }, ({ payload }) => {
    beginOnlineRound(payload.paragraph);
  });

  channel.on('broadcast', { event: 'hit' }, ({ payload }) => {
    console.log('[lobby] received hit broadcast:', payload);
    applyRemoteHit(payload.damage);
  });

  channel.on('broadcast', { event: 'result' }, ({ payload }) => {
    onlineOpponentStats = payload;
    maybeShowOnlineResult();
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED'){
      await channel.track({ joinedAt: Date.now() });
      if (asHost){
        el.lobbyCodeDisplay.textContent = code;
        setLobbyView('waiting');
      }
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'){
      showLobbyError('Connection lost. Check your Supabase credentials and try again.');
    }
  });

  lobbyChannel = channel;
}

function createLobby(){
  const code = generateLobbyCode();
  connectToLobby(code, true);
}

function joinLobbyFromInput(){
  const code = el.joinLobbyInput.value.trim().toUpperCase();
  if (code.length < 4){
    showLobbyError('Enter the full lobby code your friend shared.');
    return;
  }
  connectToLobby(code, false);
  el.lobbyStatusText.textContent = 'Connecting to lobby\u2026';
  setLobbyView('waiting');
  el.lobbyCodeDisplay.textContent = code;
}

async function startOnlineLobbyRound(){
  el.lobbyStatusDot.classList.add('connected');
  el.lobbyStatusText.textContent = 'Friend joined! Loading paragraph\u2026';
  const paragraph = await fetchRandomParagraph();
  broadcastLobbyEvent('start', { paragraph });
  beginOnlineRound(paragraph);
}

function beginOnlineRound(paragraph){
  onlineOwnStats = null;
  onlineOpponentStats = null;
  lastBattleVariant = 'online'; // keeps the local AI/PVP rematch shortcuts from misfiring after this
  showScreen('battle-pvp-online');
  resetTest(paragraph);
}

function maybeShowOnlineResult(){
  if (!onlineOwnStats) return; // I haven't finished my own round yet -- nothing to show
  if (onlineOpponentStats){
    const mine = onlineOwnStats;
    const theirs = onlineOpponentStats;
    let koSide;
    if (mine.wonAllThreeBars && !theirs.wonAllThreeBars) koSide = 'left';
    else if (!mine.wonAllThreeBars && theirs.wonAllThreeBars) koSide = 'right';
    else if (mine.damage === theirs.damage) koSide = 'tie';
    else koSide = mine.damage > theirs.damage ? 'left' : 'right';

    showBattleResult({
      leftLabel: 'You', leftWpm: mine.wpm, leftDamage: mine.damage,
      rightLabel: 'Friend', rightWpm: theirs.wpm, rightDamage: theirs.damage,
      koSide,
    });
  } else {
    showScreen('friend-lobby');
    setLobbyView('result-wait');
  }
}

function returnFromArena(){
  // stop any running test/timer/bot loop if leaving mid-round, so nothing
  // keeps ticking or firing keydown-driven combat logic in the background
  clearInterval(state.timerId);
  clearInterval(botTimerId);
  clearTimeout(koResultTimeoutId); // a pending KO result must not fire on a screen we've left
  state.finished = true;
  if (currentMode === 'battle-pvp-online'){
    leaveLobby();
    showScreen('pvp-select');
  } else if (currentMode === 'battle-ai' || currentMode === 'battle-pvp'){
    showScreen('battle-select');
  } else {
    showScreen('menu');
  }
}

function goToTopMenu(){
  clearInterval(state.timerId);
  clearInterval(botTimerId);
  clearTimeout(koResultTimeoutId);
  leaveLobby();
  state.finished = true;
  showScreen('menu');
}

/* ---------------------------------------------------------
   WIRE UP
--------------------------------------------------------- */
document.addEventListener('keydown', handleKeydown);
el.hiddenInput.addEventListener('input', handleHiddenInput);
document.addEventListener('click', focusInput);
el.restartBtn.addEventListener('click', restartCurrentRound);
el.tryAgainBtn.addEventListener('click', restartCurrentRound);

el.selectNormalBtn.addEventListener('click', enterNormalMode);
el.selectBattleBtn.addEventListener('click', enterBattleSelect);
el.backToMenuBtn.addEventListener('click', returnFromArena);
el.backFromBattleBtn.addEventListener('click', goToTopMenu);

el.selectAiBtn.addEventListener('click', enterBattleAI);
el.selectPvpBtn.addEventListener('click', enterPvpSubSelect);

el.selectLocalPvpBtn.addEventListener('click', enterBattlePVP);
el.selectFriendPvpBtn.addEventListener('click', enterFriendLobby);
// Random matchmaking is a future build (see the mode-select conversation) -- the
// card is visually disabled and intentionally has no click handler for now.
el.backFromPvpSubSelectBtn.addEventListener('click', () => showScreen('battle-select'));

el.createLobbyBtn.addEventListener('click', createLobby);
el.joinLobbyBtn.addEventListener('click', joinLobbyFromInput);
el.joinLobbyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinLobbyFromInput();
});
el.backFromFriendLobbyBtn.addEventListener('click', () => {
  leaveLobby();
  showScreen('pvp-select');
});

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