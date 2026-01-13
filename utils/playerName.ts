export const PLAYER_NAME_MAX_LENGTH = 20;
export const PLAYER_NAME_PATTERN = /^[a-zA-Z0-9가-힣\s._-]+$/;

export type PlayerNameError = 'required' | 'tooLong' | 'invalidChars';

export const normalizePlayerName = (value: string): string => value.trim();

export const validatePlayerName = (value: string): PlayerNameError | null => {
  const trimmed = normalizePlayerName(value);
  if (trimmed.length === 0) return 'required';
  if (trimmed.length > PLAYER_NAME_MAX_LENGTH) return 'tooLong';
  if (!PLAYER_NAME_PATTERN.test(trimmed)) return 'invalidChars';
  return null;
};
