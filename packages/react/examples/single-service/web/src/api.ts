import type { ListAdapter } from '@adminui/react';
export type Item = { id: string; name: string };
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function item(value: unknown): Item {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.name !== 'string')
    throw Error('服务端记录格式不正确');
  return { id: value.id, name: value.name };
}
async function read(response: Response): Promise<unknown> {
  const value: unknown = await response.json();
  if (!response.ok) throw Error(isObject(value) && typeof value.message === 'string' ? value.message : `请求失败（${response.status}）`);
  return value;
}
// 稳定的模块级 adapter；Go 与 Rust 使用同一 JSON 合同，UI 无需知道后端语言。
export const listItems: ListAdapter<Item> = async (query, { signal }) => {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize),
    search: query.search, sort: query.sort?.key ?? 'id', direction: query.sort?.direction ?? 'desc' });
  const value = await read(await fetch(`/api/admin/items?${params}`, { signal, credentials: 'same-origin' }));
  if (!isObject(value) || !Array.isArray(value.rows) || typeof value.total !== 'number' || !Number.isSafeInteger(value.total) || value.total < 0)
    throw Error('服务端列表格式不正确');
  return { rows: value.rows.map(item), total: value.total };
};
export async function createItem(name: string): Promise<Item> {
  return item(await read(await fetch('/api/admin/items', { method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-AdminUI-Request': '1' }, body: JSON.stringify({ name }) })));
}
