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

let currentCard: CardSummary | null = null;
let streak = 0;
let bestStreak = 0;
let allSets: Set[] = [];

const BASE_URL = 'https://api.tcgdex.net/v2/en';

// DOM Elements
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
const form = document.getElementById('guess-form') as HTMLFormElement;

async function fetchSets() {
  try {
    const res = await fetch(`${BASE_URL}/sets`);
    allSets = await res.json();
  } catch (error) {
    console.error("Failed to fetch sets", error);
  }
}

async function loadRandomCard() {
  // Reset UI
  wrapper.classList.add('loading');
  wrapper.classList.remove('revealed');
  wrapper.classList.add('zoomed');
  imageElement.style.opacity = '0';
  imageElement.src = '';
  
  guessInput.value = '';
  guessInput.disabled = true;
  submitBtn.disabled = true;
  skipBtn.disabled = true;
  nextBtn.classList.add('hidden');
  feedbackOverlay.classList.add('hidden');
  
  if (allSets.length === 0) await fetchSets();
  
  // Pick random set and get cards
  let foundCard = false;
  
  while (!foundCard) {
    const randomSet = allSets[Math.floor(Math.random() * allSets.length)];
    try {
      const res = await fetch(`${BASE_URL}/sets/${randomSet.id}`);
      const setDetails: SetDetails = await res.json();
      
      const cardsInSet = setDetails.cards.filter(c => c.image); // Only cards with images
      if (cardsInSet.length > 0) {
        currentCard = cardsInSet[Math.floor(Math.random() * cardsInSet.length)];
        foundCard = true;
      }
    } catch (e) {
      console.warn("Retrying fetch due to error", e);
    }
  }

  // Set the image src and wait for load
  if (currentCard && currentCard.image) {
    const imgUrl = `${currentCard.image}/high.webp`;
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

function normalizeString(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function checkGuess(guess: string) {
  if (!currentCard) return;
  
  const target = normalizeString(currentCard.name);
  const input = normalizeString(guess);
  
  if (input === target || target.includes(input) && input.length >= 4) {
    // Correct guess - accept if exact match or if target includes the input (so "Pikachu" matches "Pikachu VMAX" for fairness)
    handleCorrect();
  } else {
    // We could shake the input or show small error here, but for now just clear or let them guess again
    guessInput.classList.add('error');
    setTimeout(() => guessInput.classList.remove('error'), 300);
  }
}

function handleCorrect() {
  streak++;
  if (streak > bestStreak) bestStreak = streak;
  updateScore();
  
  revealCard(true);
}

function handleSkip() {
  streak = 0;
  updateScore();
  revealCard(false);
}

function revealCard(isCorrect: boolean) {
  wrapper.classList.remove('zoomed');
  wrapper.classList.add('revealed');
  
  guessInput.disabled = true;
  submitBtn.disabled = true;
  skipBtn.disabled = true;
  
  feedbackText.textContent = isCorrect ? 'Correct!' : 'Skipped';
  feedbackText.className = isCorrect ? 'correct-text' : 'wrong-text';
  feedbackSubtext.textContent = `It was ${currentCard?.name}`;
  
  feedbackOverlay.classList.remove('hidden');
  
  // Show next card button inside controls
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

// Start
loadRandomCard();
