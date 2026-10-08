import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { List, Plus } from 'lucide-react';
import { AdminProvider, AdminShell, Button, DataTable, FormDialog, FormField, Input,
  NotificationProvider, PageHeader, QueryBar, AppearanceButton, useDataSource, useNotify,
  type Column, type ListQuery } from '@adminui/react';
import '@adminui/react/styles.css';
import { createItem, listItems, type Item } from './api';
const initial: ListQuery = { page: 1, pageSize: 10, search: '', filters: {}, sort: { key: 'id', direction: 'desc' } };
const columns: Column<Item>[] = [
  { key: 'id', title: '编号', sortable: true, render: row => row.id },
  { key: 'name', title: '名称', sortable: true, render: row => row.name },
];
function Items() {
  const [query, setQuery] = useState(initial);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const result = useDataSource(listItems, query);
  const notify = useNotify();
  return <>
    <PageHeader title="工具清单" actions={<Button onClick={() => { setName(''); setOpen(true); }}><Plus size={16}/>新增记录</Button>}/>
    <QueryBar value={search} onChange={setSearch} onSearch={() => setQuery(q => ({ ...q, page: 1, search }))}
      onReset={() => { setSearch(''); setQuery(initial); }}/>
    <DataTable caption="工具清单" columns={columns} rows={result.data?.rows ?? []} rowKey={row => row.id}
      loading={result.loading} error={result.error} onRetry={result.reload} sort={query.sort}
      onSortChange={sort => setQuery(q => ({ ...q, sort, page: 1 }))}
      pagination={{ mode: 'page', total: result.data?.total ?? 0, page: query.page, pageSize: query.pageSize,
        onPageChange: page => setQuery(q => ({ ...q, page })),
        onPageSizeChange: pageSize => setQuery(q => ({ ...q, pageSize, page: 1 })) }}/>
    <FormDialog title="新增记录" description="填写名称并保存到工具清单。" open={open} onClose={() => setOpen(false)} dirty={name.length > 0}
      onSubmit={async () => { await createItem(name); result.reload(); notify('记录已保存', 'success'); }}>
      <FormField label="名称" htmlFor="item-name" hint="1–80 个字符，名称不可重复" required>
        <Input id="item-name" value={name} onChange={event => setName(event.target.value)} aria-describedby="item-name-hint"/>
      </FormField>
    </FormDialog>
  </>;
}
function App() {
  return <AdminShell brand="工具管理" activeId="items" navigation={[{ id: 'items', title: '工具清单', icon: List }]}
    onNavigate={() => {}} onCloseTab={() => {}} headerActions={<AppearanceButton/>}
    tabs={[{ id: 'items', title: '工具清单', icon: List, closable: false, content: <Items/> }]}/>;
}
createRoot(document.getElementById('root')!).render(<AdminProvider storageKey="single-service:admin-theme">
  <NotificationProvider><App/></NotificationProvider>
</AdminProvider>);
