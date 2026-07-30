import type { Ctx } from "./bot.js";

export interface LibraryItem {
  id: string;
  title: string;
  description: string;
  fileId?: string;
  link?: string;
  duration?: string;
  size?: string;
  tags: string[];
  menuId: string;
  views: number;
  downloads: number;
  updatedAt: string;
}

export interface LibraryMenu {
  id: string;
  title: string;
  parentId?: string;
  order: number;
}

export interface Profile {
  id: number;
  bookmarks: string[];
  history: Array<{ itemId: string; position?: number }>;
  lastSeen: string;
}

export interface LibraryState {
  menus: LibraryMenu[];
  items: LibraryItem[];
  profile: Profile;
  flow?: { kind: "search" | "menu" | "item" | "broadcast" | "metadata" | "import"; menuId?: string; itemId?: string; audience?: "all" | "active" };
  selectedTag?: string;
  isAdmin?: boolean;
  lastDailySummary?: string;
}

const state = (ctx: Ctx): LibraryState => {
  const session = ctx.session as { library?: LibraryState };
  if (!session.library) {
    session.library = {
      menus: [],
      items: [],
      profile: { id: ctx.from?.id ?? 0, bookmarks: [], history: [], lastSeen: now().toISOString() },
    };
  }
  session.library.profile.lastSeen = now().toISOString();
  return session.library;
};

let clock: () => Date = () => new Date();
export const now = (): Date => clock();
/** Test seam for all library timestamps. */
export const setClock = (value?: () => Date): void => { clock = value ?? (() => new Date()); };

export const library = state;
export const idFor = (prefix: string, values: { id: string }[]): string => {
  let n = values.length + 1;
  while (values.some((value) => value.id === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
};
export const short = (text: string, length = 42): string => text.length > length ? `${text.slice(0, length - 1)}…` : text;
export const clean = (text: string): string => text.trim().replace(/\s+/g, " ");
export const findItem = (ctx: Ctx, id: string): LibraryItem | undefined => library(ctx).items.find((item) => item.id === id);
export const findMenu = (ctx: Ctx, id: string): LibraryMenu | undefined => library(ctx).menus.find((menu) => menu.id === id);
export const children = (ctx: Ctx, parentId?: string): LibraryMenu[] =>
  library(ctx).menus.filter((menu) => menu.parentId === parentId).sort((a, b) => a.order - b.order);
export const menuItems = (ctx: Ctx, menuId: string): LibraryItem[] =>
  library(ctx).items.filter((item) => item.menuId === menuId);
export const rememberView = (ctx: Ctx, item: LibraryItem): void => {
  const profile = library(ctx).profile;
  item.views++;
  profile.history = [{ itemId: item.id }, ...profile.history.filter((entry) => entry.itemId !== item.id)].slice(0, 20);
};
export const setPosition = (ctx: Ctx, itemId: string, position: number): void => {
  const profile = library(ctx).profile;
  const prior = profile.history.find((entry) => entry.itemId === itemId);
  if (prior) prior.position = position;
};
export const isBookmarked = (ctx: Ctx, itemId: string): boolean => library(ctx).profile.bookmarks.includes(itemId);
export const escape = (text: string): string => text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
