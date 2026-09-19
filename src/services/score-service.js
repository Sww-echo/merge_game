const SCORE_API = '/api/scores';

function getOrCreatePlayerId() {
  const storageKey = 'suika-player-id';
  let playerId = localStorage.getItem(storageKey);

  if (!playerId) {
    playerId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(storageKey, playerId);
  }

  return playerId;
}

export function getPlayerProfile() {
  return {
    playerId: getOrCreatePlayerId(),
    name: localStorage.getItem('suika-player-name') || 'Player',
  };
}

export function savePlayerName(name) {
  const normalizedName = name.trim().slice(0, 24) || 'Player';
  localStorage.setItem('suika-player-name', normalizedName);
  return normalizedName;
}

export async function saveScore({ score, name }) {
  const profile = getPlayerProfile();
  const response = await fetch(SCORE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: profile.playerId,
      name: name || profile.name,
      score,
    }),
  });

  if (!response.ok) {
    throw new Error(`Score service returned ${response.status}.`);
  }

  return response.json();
}

export async function loadScores(limit = 5) {
  const response = await fetch(`${SCORE_API}?limit=${limit}`);
  if (!response.ok) throw new Error(`Score service returned ${response.status}.`);
  return response.json();
}
