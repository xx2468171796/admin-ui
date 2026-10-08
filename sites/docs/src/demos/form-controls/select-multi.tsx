import { useState } from "react";
import { FormField, MultiChoice, type SelectItem } from "@adminui/react";
import { PEOPLE } from "../../data/demo-data";

const PRODUCTS: SelectItem[] = [
  { value: "crm", label: "客户管理", tone: "green" },
  { value: "ticket", label: "工单", tone: "blue" },
  { value: "bi", label: "数据看板", tone: "violet" },
  { value: "im", label: "在线客服", tone: "teal" },
  { value: "sign", label: "电子合同", tone: "orange" },
  { value: "hr", label: "人事", tone: "pink" },
  { value: "api", label: "开放接口", tone: "gray" },
];

/** 多选：已选是可删标签，放不下收成「+N」；点一下就生效，点外面关闭（没有「完成」按钮）；超出上限写在下面一行。 */
export function Demo() {
  const [products, setProducts] = useState<string[]>(["crm", "ticket", "bi"]);
  const [members, setMembers] = useState<string[]>(["u02", "u05"]);
  const [error, setError] = useState<string | undefined>();
  const people: SelectItem[] = PEOPLE.map((p) => ({ value: p.id, label: p.name, avatar: "", hint: p.title }));

  const changeMembers = (next: string[]) => {
    if (next.length > 3) {
      setError("最多选 3 位协作人；要换人先删掉一位");
      return;
    }
    setMembers(next);
    setError(undefined);
  };

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 420 }}>
      <FormField label="感兴趣的产品" htmlFor="sm-products">
        <MultiChoice id="sm-products" label="感兴趣的产品" options={PRODUCTS} value={products} onChange={setProducts} />
      </FormField>
      <FormField label="协作人" htmlFor="sm-members" hint="最多 3 位" error={error}>
        <MultiChoice id="sm-members" label="协作人" options={people} value={members} onChange={changeMembers} />
      </FormField>
      <FormField label="筛选：产品（小号，一行放不下收成 +N）" htmlFor="sm-filter">
        <MultiChoice id="sm-filter" label="筛选产品" size="sm" options={PRODUCTS} value={products} onChange={setProducts} />
      </FormField>
    </div>
  );
}
