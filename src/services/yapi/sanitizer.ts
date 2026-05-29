import type {
  ApiInterface,
  ApiSearchResultItem,
  CategoryInfo,
  ProjectInfo,
  SanitizedApiInterface,
  SanitizedSearchResultItem,
  SanitizedCategoryInfo,
  SanitizedProjectInfo,
} from "./types";

/** 递归移除值为 null / undefined / 空字符串的字段 */
function removeNullish<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      const cleaned = value
        .map((item) => (typeof item === "object" && item !== null ? removeNullish(item) : item))
        .filter((item) => item !== null && item !== undefined && item !== "");
      if (cleaned.length > 0) result[key] = cleaned;
      continue;
    }
    if (typeof value === "object") {
      const cleaned = removeNullish(value);
      if (Object.keys(cleaned).length > 0) result[key] = cleaned;
      continue;
    }
    result[key] = typeof value === "string" ? value.trim() : value;
  }
  return result;
}

/** 正则去除 HTML 标签，保留纯文本 */
function stripHtml(html: string): string {
  if (!html || !html.includes("<")) return html;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 简化 JSON Schema：移除对 LLM 无用的元信息 */
function simplifyJsonSchema(schemaStr: string): string {
  if (!schemaStr) return schemaStr;
  try {
    const schema = JSON.parse(schemaStr);
    if (typeof schema !== "object") return schemaStr;

    // 递归清理 JSON Schema 元信息
    function cleanNode(node: any): any {
      if (typeof node !== "object" || node === null) return node;
      const cleaned: Record<string, any> = {};
      const skipKeys = ["$schema", "$id", "$comment", "definitions"];
      for (const [key, value] of Object.entries(node)) {
        if (skipKeys.includes(key)) continue;
        cleaned[key] = typeof value === "object" ? cleanNode(value) : value;
      }
      return cleaned;
    }

    return JSON.stringify(cleanNode(schema), null, 2);
  } catch {
    // 不是合法 JSON，原样返回（可能已被 stripHtml 处理过）
    return schemaStr;
  }
}

/** 时间戳统一转为 ISO 字符串 */
function toISO(timestamp: number | string | undefined): string | undefined {
  if (!timestamp) return undefined;
  const num = typeof timestamp === "string" ? parseInt(timestamp, 10) : timestamp;
  if (isNaN(num) || num <= 0) return undefined;
  // 如果超过 10000000000（大约是 2286 年），说明已经是毫秒级了，无需再乘 1000
  const ms = num > 9999999999 ? num : num * 1000; 
  return new Date(ms).toISOString();
}

/** 过滤参数数组中无用的条目（required="0" 且无 desc 的） */
function filterUselessParams(items: any[]): any[] {
  if (!items || !Array.isArray(items)) return [];
  return items.filter((item) => {
    // 保留 required=1 的或有描述的参数
    if (item.required === "1" || item.required === 1 || item.required === true) return true;
    if (item.desc && item.desc.trim()) return true;
    if (item.name && item.name.trim()) return true;
    return false;
  });
}

// ─── 公开清洗函数 ───

export function sanitizeProjectInfo(raw: ProjectInfo): SanitizedProjectInfo {
  const cleaned = removeNullish({
    _id: raw._id,
    name: stripHtml(raw.name),
    desc: stripHtml(raw.desc),
    group_id: raw.group_id,
    basepath: raw.basepath,
  });
  return cleaned as SanitizedProjectInfo;
}

export function sanitizeCategoryInfo(raw: CategoryInfo): SanitizedCategoryInfo {
  const cleaned = removeNullish({
    _id: raw._id,
    name: stripHtml(raw.name),
    desc: stripHtml(raw.desc),
    project_id: raw.project_id,
    add_time: toISO(raw.add_time),
    up_time: toISO(raw.up_time),
    index: raw.index,
  });
  return cleaned as SanitizedCategoryInfo;
}

export function sanitizeSearchResult(raw: ApiSearchResultItem): SanitizedSearchResultItem {
  const cleaned = removeNullish({
    _id: raw._id,
    title: stripHtml(raw.title),
    path: raw.path,
    method: raw.method,
    project_id: raw.project_id,
    catid: raw.catid,
    add_time: toISO(raw.add_time),
    up_time: toISO(raw.up_time),
    project_name: raw.project_name,
    cat_name: raw.cat_name,
  });
  return cleaned as SanitizedSearchResultItem;
}

export function sanitizeApiInterface(raw: ApiInterface): SanitizedApiInterface {
  const cleaned = removeNullish({
    _id: raw._id,
    title: stripHtml(raw.title),
    path: raw.path,
    method: raw.method,
    desc: stripHtml(raw.desc),
    markdown: stripHtml(raw.markdown),

    req_params: filterUselessParams(raw.req_params),
    req_query: filterUselessParams(raw.req_query),
    req_headers: filterUselessParams(raw.req_headers),
    req_body_type: raw.req_body_type,
    req_body_form: filterUselessParams(raw.req_body_form),
    req_body_other: simplifyJsonSchema(stripHtml(raw.req_body_other)),
    res_body_type: raw.res_body_type,
    res_body: simplifyJsonSchema(stripHtml(raw.res_body)),
  });

  return cleaned as SanitizedApiInterface;
}
