/**
 * SHA-256 해시 유틸리티
 * 여러 API에서 install_id 해싱에 공통 사용
 */
export const sha256Hex = async (input: string): Promise<string> => {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * install_id를 서버 솔트와 결합하여 해시
 * @returns null if salt is missing or installId is empty
 */
export const hashInstallId = async (
  installId: string | undefined | null,
  salt: string | undefined
): Promise<string | null> => {
  if (!installId || !salt) return null;
  return sha256Hex(`${salt}:${installId}`);
};
