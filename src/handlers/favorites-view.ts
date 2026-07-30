import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { findItem, library, short } from "../library.js";
registerMainMenuItem({ label: "Favorites", data: "favorites:view", order: 30 });
const composer = new Composer<Ctx>();
composer.callbackQuery("favorites:view", async (ctx) => {
  const items = library(ctx).profile.bookmarks.map((id) => findItem(ctx, id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  await ctx.answerCallbackQuery();
  if (!items.length) { await ctx.editMessageText("No favorites yet — save an item while browsing to keep it here.", { reply_markup: inlineKeyboard([[inlineButton("Browse library", "browse:root")], [inlineButton("Home", "menu:main")]]) }); return; }
  await ctx.editMessageText("Your saved items:", { reply_markup: inlineKeyboard([...items.map((item) => [inlineButton(short(item.title), `item:${item.id}`)]), [inlineButton("Home", "menu:main")]]) });
});
export default composer;
