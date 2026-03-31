import './style.css'

interface Set {
  id: string;
  name: string;
}

interface CardSummary {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

interface SetDetails {
  cards: CardSummary[];
}

type GameMode = 'moving' | 'zoom' | 'set';

let currentMode: GameMode = 'moving';
let currentCard: CardSummary | null = null;
let currentSet: Set | null = null;
let allSets: Set[] = [];

// Scores
let streak = 0;
let bestStreak = 0;

// Zoom specific
let lives = 5;
const zoomScales = [8.0, 7.5, 7.0, 6.5, 2.5];

const BASE_URL = 'https://api.tcgdex.net/v2/en';

// DOM Elements
const homeView = document.getElementById('home-view')!;
const gameView = document.getElementById('game-view')!;
const modeTitle = document.getElementById('mode-title')!;
const backHomeBtn = document.getElementById('back-home-btn') as HTMLButtonElement;

const wrapper = document.getElementById('card-wrapper')!;
const imageElement = document.getElementById('card-image') as HTMLImageElement;
const guessInput = document.getElementById('guess-input') as HTMLInputElement;
const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
const skipBtn = document.getElementById('skip-btn') as HTMLButtonElement;
const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
const feedbackOverlay = document.getElementById('feedback-overlay')!;
const feedbackText = document.getElementById('feedback-text')!;
const feedbackSubtext = document.getElementById('feedback-subtext')!;

const streakEl = document.getElementById('streak-counter')!;
const bestEl = document.getElementById('best-counter')!;
const livesContainer = document.getElementById('lives-container')!;
const livesEl = document.getElementById('lives-counter')!;
const form = document.getElementById('guess-form') as HTMLFormElement;

const modeBtns = document.querySelectorAll('.mode-btn');

/* ---------------------------------
   ROUTING
--------------------------------- */
function handleRoute() {
  const hash = window.location.hash.replace('#', '');
  
  if (hash === 'moving' || hash === 'zoom' || hash === 'set') {
    startGame(hash as GameMode);
  } else {
    // Show landing
    homeView.classList.remove('hidden');
    gameView.classList.add('hidden');
    // Stop any loading or game elements
    wrapper.classList.remove('moving-pan', 'cut-bottom');
    imageElement.src = '';
  }
}

window.addEventListener('hashchange', handleRoute);

modeBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const btnEl = e.currentTarget as HTMLButtonElement;
    window.location.hash = btnEl.dataset.mode || 'moving';
  });
});

backHomeBtn.addEventListener('click', () => {
  window.location.hash = 'home';
});


/* ---------------------------------
   GAME LOGIC
--------------------------------- */
async function startGame(mode: GameMode) {
  currentMode = mode;
  streak = 0;
  updateScore();
  
  homeView.classList.add('hidden');
  gameView.classList.remove('hidden');
  
  // Setup Title
  if (mode === 'moving') modeTitle.textContent = 'Moving Card';
  if (mode === 'zoom') modeTitle.textContent = 'Zoom Out';
  if (mode === 'set') modeTitle.textContent = 'Guess the Set';

  // Specific initial UI states
  if (mode === 'zoom') {
    livesContainer.style.display = 'flex';
  } else {
    livesContainer.style.display = 'none';
  }

  loadRandomCard();
}

async function fetchSets() {
  try {
    const res = await fetch(`${BASE_URL}/sets`);
    allSets = await res.json();
  } catch (error) {
    console.error("Failed to fetch sets", error);
  }
}

async function loadRandomCard() {
  // Reset UI classes
  wrapper.className = 'card-wrapper loading'; // clear custom classes except base
  imageElement.style.opacity = '0';
  imageElement.style.transform = '';
  imageElement.src = '';
  
  // Default states
  guessInput.value = '';
  guessInput.disabled = true;
  guessInput.placeholder = currentMode === 'set' ? "Enter Set Name" : "Who's that Pokemon?";
  submitBtn.disabled = true;
  skipBtn.disabled = true;

  nextBtn.classList.add('hidden');
  feedbackOverlay.classList.add('hidden');
  
  if (currentMode === 'zoom') {
    lives = 5;
    livesEl.textContent = lives.toString();
  }
  
  if (allSets.length === 0) await fetchSets();
  
  let foundCard = false;
  
  while (!foundCard) {
    const randomSet = allSets[Math.floor(Math.random() * allSets.length)];
    try {
      const res = await fetch(`${BASE_URL}/sets/${randomSet.id}`);
      const setDetails: SetDetails = await res.json();
      
      const cardsInSet = setDetails.cards.filter(c => c.image);
      if (cardsInSet.length > 0) {
        currentSet = randomSet;
        currentCard = cardsInSet[Math.floor(Math.random() * cardsInSet.length)];
        foundCard = true;
      }
    } catch (e) {
      console.warn("Retrying fetch due to error", e);
    }
  }

  if (currentCard && currentCard.image) {
    const imgUrl = `${currentCard.image}/high.webp`;
    
    // Apply visuals BEFORE setting src to prevent CSS zoom-in animation
    applyModeVisuals();
    
    imageElement.src = imgUrl;
    
    imageElement.onload = () => {
      wrapper.classList.remove('loading');
      imageElement.style.opacity = '1';
      
      guessInput.disabled = false;
      submitBtn.disabled = false;
      skipBtn.disabled = false;
      guessInput.focus();
    };
  }
}

function applyModeVisuals() {
  if (currentMode === 'moving') {
    wrapper.classList.add('moving-pan');
  } else if (currentMode === 'set') {
    wrapper.classList.add('cut-bottom');
  } else if (currentMode === 'zoom') {
    imageElement.style.transform = `scale(${zoomScales[0]})`;
    
    // Randomize starting origin between 20% and 80% to avoid corners
    const randX = Math.floor(Math.random() * 60) + 20;
    const randY = Math.floor(Math.random() * 60) + 20;
    imageElement.style.transformOrigin = `${randX}% ${randY}%`;
  }
}

function normalizeString(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function checkGuess(guess: string) {
  if (!currentCard || !currentSet) return;
  
  const targetRaw = currentMode === 'set' ? currentSet.name : currentCard.name;
  const target = normalizeString(targetRaw);
  const input = normalizeString(guess);
  
  // Exact or subset match
  if (input === target || (target.includes(input) && input.length >= 4)) {
    handleCorrect();
  } else {
    handleWrong();
  }
}

function handleWrong() {
  guessInput.classList.add('error');
  setTimeout(() => guessInput.classList.remove('error'), 300);
  
  if (currentMode === 'zoom') {
    lives--;
    livesEl.textContent = lives.toString();
    
    // Zoom out depending on the lives left
    const mistakes = 5 - lives;
    if (mistakes < zoomScales.length) {
      imageElement.style.transform = `scale(${zoomScales[mistakes]})`;
    }
    
    if (lives <= 0) {
      // Game Over immediately
      streak = 0;
      updateScore();
      revealCard(false, 'Out of guesses!');
    } else {
      guessInput.value = '';
    }
  } else {
    guessInput.value = '';
  }
}

function handleCorrect() {
  streak++;
  if (streak > bestStreak) bestStreak = streak;
  updateScore();
  
  revealCard(true, 'Correct!');
}

function handleSkip() {
  streak = 0;
  updateScore();
  revealCard(false, 'Skipped');
}

function revealCard(isWin: boolean, titleText: string) {
  wrapper.className = 'card-wrapper revealed'; // Resets moving-pan or cut-bottom
  imageElement.style.transform = 'scale(1)'; // Resets zoom inline
  
  guessInput.disabled = true;
  submitBtn.disabled = true;
  skipBtn.disabled = true;
  
  feedbackText.textContent = titleText;
  feedbackText.className = isWin ? 'correct-text' : 'wrong-text';

  const answer = currentMode === 'set' ? `Set: ${currentSet?.name} (${currentCard?.name})` : `Card: ${currentCard?.name}`;
  feedbackSubtext.textContent = `It was ${answer}`;
  
  feedbackOverlay.classList.remove('hidden');
  
  nextBtn.classList.remove('hidden');
  nextBtn.focus();
}

function updateScore() {
  streakEl.textContent = streak.toString();
  bestEl.textContent = bestStreak.toString();
}

// Event Listeners
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const guess = guessInput.value.trim();
  if (guess) checkGuess(guess);
});

skipBtn.addEventListener('click', handleSkip);
nextBtn.addEventListener('click', loadRandomCard);

// Handle initial load
handleRoute();
