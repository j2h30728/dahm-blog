export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export type NotionPage = {
  id: string;
  properties: Record<string, unknown>;
  last_edited_time: string;
  archived?: boolean;
  in_trash?: boolean;
};

export interface NotionConfig {
  token: string;
  dataSourceId?: string;
  databaseId?: string;
}

export function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Notion 응답 형식 오류: ${label}`);
  }
  return value as Record<string, unknown>;
}

export function notionId(value: string): string {
  const id = value.replace(/-/g, "").toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error("Notion ID는 32자리 UUID여야 합니다.");
  return id;
}

export function property(page: NotionPage, name: string): Record<string, unknown> {
  return object(page.properties[name], `${page.id}: ${name}`);
}

export function textProperty(page: NotionPage, name: string): string {
  const p = property(page, name);
  const values = p[p.type as string];
  if (!Array.isArray(values)) throw new Error(`Notion 텍스트 속성 형식 오류: ${page.id}: ${name}`);
  return values.map((item) => {
    const value = object(item, name);
    return typeof value.plain_text === "string" ? value.plain_text : String(object(value.text, name).content ?? "");
  }).join("").trim();
}

export function selectProperty(page: NotionPage, name: string): string {
  const p = property(page, name);
  const selected = p[p.type as string];
  return selected ? String(object(selected, name).name ?? "") : "";
}

export class NotionClient {
  constructor(
    private readonly config: NotionConfig,
    private readonly fetcher: Fetch = fetch,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  private async request(endpoint: string, body?: unknown): Promise<Record<string, unknown>> {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      try {
        response = await this.fetcher(`https://api.notion.com/v1/${endpoint}`, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            Authorization: `Bearer ${this.config.token}`,
            "Notion-Version": "2026-03-11",
            "Content-Type": "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(30_000),
          redirect: "error",
        });
      } catch {
        if (attempt < 2) {
          await this.sleep(500 * 2 ** attempt);
          continue;
        }
        throw new Error("Notion API 네트워크 요청 실패 또는 시간 초과");
      }
      let data: Record<string, unknown>;
      try {
        data = object(await response.json(), "JSON");
      } catch {
        throw new Error(`Notion API JSON 응답 오류 (HTTP ${response.status})`);
      }
      if (response.ok) return data;
      const retryable = [429, 500, 502, 503, 504, 529].includes(response.status)
        && data.code !== "public_api_request_blocked";
      if (retryable && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delay = retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
        if (delay <= 30_000) {
          await this.sleep(delay);
          continue;
        }
      }
      throw new Error(`Notion API HTTP ${response.status}: 토큰·DB 연결 권한·속성 설정을 확인하세요.`);
    }
    throw new Error("Notion API 재시도 한도 초과");
  }

  async publishedPosts(): Promise<NotionPage[]> {
    let sourceId = this.config.dataSourceId;
    if (!sourceId) {
      const database = await this.request(`databases/${notionId(this.config.databaseId ?? "")}`);
      if (!Array.isArray(database.data_sources) || database.data_sources.length !== 1) {
        throw new Error("DB의 데이터 소스가 하나가 아닙니다. NOTION_DATA_SOURCE_ID를 지정하세요.");
      }
      sourceId = String(object(database.data_sources[0], "data source").id);
    }
    sourceId = notionId(sourceId);
    const source = await this.request(`data_sources/${sourceId}`);
    const schema = object(source.properties, "data source properties");
    const statusType = object(schema.status, "status schema").type;
    if (!["select", "status"].includes(String(statusType)) || object(schema.type, "type schema").type !== "select") {
      throw new Error("Notion status는 select/status, type은 select 속성이어야 합니다.");
    }
    const pages: NotionPage[] = [];
    const cursors = new Set<string>();
    const ids = new Set<string>();
    let cursor: string | undefined;
    do {
      const result = await this.request(`data_sources/${sourceId}/query`, {
        filter: { and: [
          { property: "status", [String(statusType)]: { equals: "published" } },
          { property: "type", select: { equals: "post" } },
        ] },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      });
      if (result.request_status && object(result.request_status, "request_status").type === "incomplete") {
        throw new Error("Notion 조회 결과가 불완전합니다. 공개 글을 일부만 발행할 수 없습니다.");
      }
      if (!Array.isArray(result.results) || typeof result.has_more !== "boolean") {
        throw new Error("Notion 페이지 목록 응답 형식 오류");
      }
      for (const value of result.results) {
        const page = object(value, "page");
        if (page.object !== "page" || typeof page.id !== "string" || typeof page.last_edited_time !== "string") {
          throw new Error("Notion page 응답 형식 오류");
        }
        const id = notionId(page.id);
        if (ids.has(id)) throw new Error(`Notion 페이지 중복: ${id}`);
        ids.add(id);
        object(page.properties, "page properties");
        const parsed = page as unknown as NotionPage;
        if (!parsed.archived && !parsed.in_trash
          && selectProperty(parsed, "status") === "published" && selectProperty(parsed, "type") === "post") {
          pages.push(parsed);
        }
      }
      cursor = result.has_more && typeof result.next_cursor === "string" ? result.next_cursor : undefined;
      if (result.has_more && (!cursor || cursors.has(cursor) || cursors.size >= 100)) {
        throw new Error("Notion 페이지네이션이 불완전하거나 반복됩니다.");
      }
      if (cursor) cursors.add(cursor);
    } while (cursor);
    return pages;
  }

  async markdown(pageId: string): Promise<string> {
    const result = await this.request(`pages/${notionId(pageId)}/markdown`);
    if (typeof result.markdown !== "string" || result.truncated !== false
      || !Array.isArray(result.unknown_block_ids) || result.unknown_block_ids.length > 0) {
      throw new Error(`Notion 본문이 잘렸거나 지원하지 않는 블록이 있습니다: ${notionId(pageId)}`);
    }
    return result.markdown;
  }
}
