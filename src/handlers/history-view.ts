import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { findItem, library, short } from "../library.js";
registerMainMenuItem({ label: "Recently viewed", data: "history:view", order: 40 });
const composer = new Composer<Ctx>();
composer.callbackQuery("history:view", async (ctx) => {
  const entries = library(ctx).profile.history.map((entry) => ({ entry, item: findItem(ctx, entry.itemId) })).filter((row): row is { entry: { itemId: string; position?: number }; item: NonNullable<ReturnType<typeof findItem>> } => Boolean(row.item));
  await ctx.answerCallbackQuery();
  if (!entries.length) { await ctx.editMessageText("Nothing viewed yet — browse the library to build your recent list.", { reply_markup: inlineKeyboard([[inlineButton("Browse library", "browse:root")], [inlineButton("Home", "menu:main")]]) }); return; }
  await ctx.editMessageText("Recently viewed:", { reply_markup: inlineKeyboard([...entries.map(({ entry, item }) => [inlineButton(entry.position !== undefined ? `${short(item.title, 30)} · resume` : short(item.title), `item:${item.id}`)]), [inlineButton("Home", "menu:main")]]) });
});
export default composer;
