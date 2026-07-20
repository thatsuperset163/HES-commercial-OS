import { WORK_DESKS } from "./work/catalog.ts";

export type OsNavItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  keywords?: string[];
};

/** All live operating systems for menu + home search. Home is always first. */
export const OS_NAV_ITEMS: OsNavItem[] = [
  {
    id: "home",
    label: "Home",
    description: "Today’s week and next moves",
    href: "/",
    keywords: ["home", "start", "work"],
  },
  {
    id: "sales",
    label: "Sales OS",
    description: "Commercial pipeline and outreach",
    href: "/work/sales/",
    keywords: ["sales", "prospects", "crm"],
  },
  ...WORK_DESKS.map((desk) => ({
    id: desk.id,
    label: desk.id === "jobs" ? "Jobs OS" : desk.name,
    description: desk.purpose,
    href: desk.href,
    keywords: [desk.hqLabel, desk.singular, desk.id, desk.name],
  })),
];

export type QuickLink = {
  id: string;
  label: string;
  description: string;
  href: string;
};

/** High-frequency jumps — leave room to grow. */
export const HOME_QUICK_LINKS: QuickLink[] = [
  {
    id: "today-agenda",
    label: "Today’s agenda",
    description: "Open Jobs day view for today",
    href: "/work/jobs?view=day&date=TODAY",
  },
  {
    id: "requests",
    label: "Requests Center",
    description: "New leads and estimates",
    href: "/work/requests",
  },
  {
    id: "sales",
    label: "Sales OS",
    description: "Hunt and follow commercial accounts",
    href: "/work/sales/",
  },
  {
    id: "tasks",
    label: "Tasks",
    description: "Open loops and follow-ups",
    href: "/work/tasks",
  },
  {
    id: "invoices",
    label: "Invoices",
    description: "Bill it and get paid",
    href: "/work/invoices",
  },
];

export function resolveQuickHref(href: string, today: string) {
  return href.replace("TODAY", today);
}

export function filterOsNav(query: string): OsNavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return OS_NAV_ITEMS;
  return OS_NAV_ITEMS.filter((item) => {
    const hay = [item.label, item.description, ...(item.keywords ?? [])]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function jobsDayHref(dateKey: string) {
  return `/work/jobs?view=day&date=${encodeURIComponent(dateKey)}`;
}
