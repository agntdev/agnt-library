import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { children, escape, findItem, findMenu, isBookmarked, library, menuItems, rememberView, setPosition, short } from "../library.js";

registerMainMenuItem({ label: "Browse library", data: "browse:root", order: 10 });
const composer = new Composer<Ctx>();
const nav = (back = "menu:main") => [inlineButton("Back", back), inlineButton("Home", "menu:main")];

function menuText(ctx: Ctx, id?: string): string {
  if (!id) return "Browse the library. Choose a section.";
  return `Browse ${escape(findMenu(ctx, id)?.title ?? "library")}. Choose a section or item.`;
}
function menuKeyboard(ctx: Ctx, parentId?: string) {
  const rows = [
    ...children(ctx, parentId).map((menu) => [inlineButton(menu.title, `browse:m:${menu.id}`)]),
    ...menuItems(ctx, parentId ?? "").map((item) => [inlineButton(short(item.title), `item:${item.id}`)]),
    nav(parentId ? `browse:m:${findMenu(ctx, parentId)?.parentId ?? "root"}` : "menu:main"),
  ];
  return inlineKeyboard(rows);
}
function detail(ctx: Ctx, itemId: string): { text: string; keyboard: ReturnType<typeof inlineKeyboard> } | undefined {
  const item = findItem(ctx, itemId);
  if (!item) return undefined;
  const position = library(ctx).profile.history.find((entry) => entry.itemId === item.id)?.position;
  const meta = [item.description, item.duration && `Duration: ${item.duration}`, item.size && `Size: ${item.size}`, item.tags.length && `Tags: ${item.tags.join(", ")}`, position !== undefined && `Resume at ${position}s`].filter(Boolean).join("\n");
  return { text: `${escape(item.title)}\n${escape(meta || "No description provided.")}`, keyboard: inlineKeyboard([
    [inlineButton(item.fileId || item.link ? "Play or download" : "File unavailable", `open:${item.id}`)],
    [inlineButton(isBookmarked(ctx, item.id) ? "Remove favorite" : "Save favorite", `fav:${item.id}`), inlineButton("Save position", `position:${item.id}`)],
    [inlineButton("Metadata", `meta:${item.id}`)],
    [inlineButton("Back", `browse:m:${item.menuId}`), inlineButton("Home", "menu:main")],
  ]) };
}
composer.callbackQuery("browse:root", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.editMessageText(menuText(ctx), { reply_markup: menuKeyboard(ctx) }); });
composer.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (data === "browse:m:root") { await ctx.answerCallbackQuery(); await ctx.editMessageText(menuText(ctx), { reply_markup: menuKeyboard(ctx) }); return; }
  if (data.startsWith("browse:m:")) { const id = data.slice(9); if (!findMenu(ctx, id)) { await ctx.answerCallbackQuery({ text: "That section is no longer available." }); return; } await ctx.answerCallbackQuery(); await ctx.editMessageText(menuText(ctx, id), { reply_markup: menuKeyboard(ctx, id) }); return; }
  if (data.startsWith("item:")) { const item = findItem(ctx, data.slice(5)); if (!item) { await ctx.answerCallbackQuery({ text: "That item is no longer available." }); return; } rememberView(ctx, item); const view = detail(ctx, item.id)!; await ctx.answerCallbackQuery(); await ctx.editMessageText(view.text, { reply_markup: view.keyboard }); return; }
  if (data.startsWith("fav:")) { const item = findItem(ctx, data.slice(4)); if (!item) { await ctx.answerCallbackQuery({ text: "That item is no longer available." }); return; } const profile = library(ctx).profile; profile.bookmarks = isBookmarked(ctx, item.id) ? profile.bookmarks.filter((id) => id !== item.id) : [...profile.bookmarks, item.id]; const view = detail(ctx, item.id)!; await ctx.answerCallbackQuery({ text: isBookmarked(ctx, item.id) ? "Saved to favorites." : "Removed from favorites." }); await ctx.editMessageText(view.text, { reply_markup: view.keyboard }); return; }
  if (data.startsWith("open:")) { const item = findItem(ctx, data.slice(5)); if (!item || (!item.fileId && !item.link)) { await ctx.answerCallbackQuery({ text: "The protected file is unavailable." }); return; } item.downloads++; await ctx.answerCallbackQuery(); if (item.fileId) await ctx.replyWithDocument(item.fileId, { caption: item.title, protect_content: true }); else await ctx.reply(`Open this protected link: ${item.link}`, { link_preview_options: { is_disabled: true } }); return; }
  if (data.startsWith("resume:")) { const [id, raw] = data.slice(7).split(":"); const seconds = Number(raw); if (!findItem(ctx, id) || !Number.isFinite(seconds) || seconds < 0) { await ctx.answerCallbackQuery({ text: "That resume point is not available." }); return; } setPosition(ctx, id, seconds); await ctx.answerCallbackQuery({ text: "Resume point saved." }); return; }
  if (data.startsWith("position:")) { const item = findItem(ctx, data.slice(9)); if (!item) { await ctx.answerCallbackQuery({ text: "That item is no longer available." }); return; } library(ctx).flow = { kind: "item", itemId: `position:${item.id}` }; await ctx.answerCallbackQuery(); await ctx.reply("Send the position in seconds where you stopped.", { reply_markup: { force_reply: true, input_field_placeholder: "For example: 120" } }); return; }
  if (data.startsWith("meta:")) { const item = findItem(ctx, data.slice(5)); if (!item) { await ctx.answerCallbackQuery({ text: "That item is no longer available." }); return; } await ctx.answerCallbackQuery(); await ctx.editMessageText(`About ${escape(item.title)}\n${escape(item.description || "No description provided.")}\nTags: ${escape(item.tags.join(", ") || "None")}`, { reply_markup: inlineKeyboard([nav(`item:${item.id}`)]) }); return; }
  await next();
});
export default composer;
