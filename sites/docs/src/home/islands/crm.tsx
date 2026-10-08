import { Demo as KanbanDemo } from "../../demos/views/kanban-playground";
import { Demo as CalendarDemo } from "../../demos/views/calendar-month";
import { Demo as DetailDemo } from "../../demos/business/record-detail-cards";
import { registerIsland } from "../islands";

/** The hero CRM's other pages, rendered by the hero island inside its own AdminShell (see hero.tsx). */
registerIsland("crm", {
  mount() {
    throw new Error("crm 只提供部件，由 hero 渲染");
  },
  parts: { kanban: KanbanDemo, calendar: CalendarDemo, detail: DetailDemo },
});
