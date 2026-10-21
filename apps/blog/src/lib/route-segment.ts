/** 정적 렌더와 요청에서 전달하는 encoded/decoded 단일 경로 조각을 통일한다. */
export function decodeRouteSegment(value: string): string | undefined {
  try {
    const decoded = decodeURIComponent(value).normalize("NFC");
    return /^[\p{L}\p{N}][\p{L}\p{N}\p{M}._-]*$/u.test(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}
