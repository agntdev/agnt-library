import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { clean, library, short } from "../library.js";

registerMainMenuItem({ label: "Search", data: "search:init", order: 20 });
const composer = new Composer<Ctx>();
const PAGE_SIZE = 6;
const results = (ctx: Ctx, query: string) => {
  const needle = query.toLocaleLowerCase();
  const tag = library(ctx).selectedTag;
  return library(ctx).items.filter((item) =>
    (!tag || item.tags.some((value) => value.toLocaleLowerCase() === tag)) &&
    [item.title, item.description, ...item.tags].some((value) => value.toLocaleLowerCase().includes(needle)),
  );
};
function resultView(ctx: Ctx, query: string, page: number) {
  const matches = results(ctx, query);
  if (!matches.length) return { text: `No results for “${query}”. Try another title, description, or tag.`, keyboard: inlineKeyboard([[inlineButton("Search again", "search:init")], [inlineButton("Home", "menu:main")]]) };
  const total = Math.ceil(matches.length / PAGE_SIZE);
  const shown = matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const tagList = [...new Set(matches.flatMap((item) => item.tags))].slice(0, 8);
  const rows = [
    ...shown.map((item) => [inlineButton(short(item.title), `item:${item.id}`)]),
    ...(tagList.length ? [tagList.map((tag) => inlineButton(`#${short(tag, 16)}`, `search:tag:${encodeURIComponent(tag)}`))] : []),
    ...(total > 1 ? [[...(page > 0 ? [inlineButton("Previous", `search:p:${encodeURIComponent(query)}:${page - 1}`)] : []), ...(page < total - 1 ? [inlineButton("Next", `search:p:${encodeURIComponent(query)}:${page + 1}`)] : [])]] : []),
    [inlineButton("New search", "search:init"), inlineButton("Home", "menu:main")],
  ];
  return { text: `${matches.length} result${matches.length === 1 ? "" : "s"} for “${query}”.`, keyboard: inlineKeyboard(rows) };
}
composer.callbackQuery("search:init", async (ctx) => {
  library(ctx).flow = { kind: "search" }; library(ctx).selectedTag = undefined;
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Send the words you want to find. I’ll search titles, descriptions, and tags.", { reply_markup: inlineKeyboard([[inlineButton("Home", "menu:main")]]) });
});
composer.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (data.startsWith("search:p:")) { const rest = data.slice(9); const at = rest.lastIndexOf(":"); const query = decodeURIComponent(rest.slice(0, at)); const page = Number(rest.slice(at + 1)); const view = resultView(ctx, query, Number.isInteger(page) && page >= 0 ? page : 0); await ctx.answerCallbackQuery(); await ctx.editMessageText(view.text, { reply_markup: view.keyboard }); return; }
  if (data.startsWith("search:tag:")) { const tag = decodeURIComponent(data.slice(11)); library(ctx).selectedTag = tag; const query = library(ctx).flow?.itemId ?? ""; const view = resultView(ctx, query, 0); await ctx.answerCallbackQuery(); await ctx.editMessageText(view.text, { reply_markup: view.keyboard }); return; }
  await next();
});
composer.on("message:text", async (ctx, next) => {
  const store = library(ctx);
  if (store.flow?.kind !== "search") return next();
  const query = clean(ctx.message.text);
  if (!query || query.length > 120) { await ctx.reply("Send between 1 and 120 characters so I can search the library."); return; }
  store.flow = { kind: "search", itemId: query };
  const view = resultView(ctx, query, 0);
  await ctx.reply(view.text, { reply_markup: view.keyboard });
});
export default composer;
