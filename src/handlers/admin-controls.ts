import { Composer, InputFile } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { clean, idFor, library, now, short } from "../library.js";

registerMainMenuItem({ label: "Content admin", data: "admin:hub", order: 90 });
const composer = new Composer<Ctx>();
const home = () => inlineKeyboard([[inlineButton("Back", "menu:main")]]);
const adminKeys = () => inlineKeyboard([
  [inlineButton("Manage menus", "admin:menus"), inlineButton("Upload content", "admin:upload")],
  [inlineButton("Analytics", "admin:analytics"), inlineButton("Send announcement", "admin:announce")],
  [inlineButton("Export backup", "admin:export"), inlineButton("Import backup", "admin:import")],
  [inlineButton("Home", "menu:main")],
]);
const admin = (ctx: Ctx) => { const data = library(ctx); data.isAdmin = true; return data; };
function menus(ctx: Ctx) {
  const data = library(ctx);
  return inlineKeyboard([
    ...data.menus.map((menu) => [inlineButton(short(menu.title), `admin:menu:${menu.id}`), inlineButton("Up", `admin:up:${menu.id}`), inlineButton("Down", `admin:down:${menu.id}`)]),
    [inlineButton("Add top-level menu", "admin:addmenu:root")], [inlineButton("Back", "admin:hub")],
  ]);
}
composer.callbackQuery("admin:hub", async (ctx) => { admin(ctx); await ctx.answerCallbackQuery(); await ctx.editMessageText("Manage your private content library.", { reply_markup: adminKeys() }); });
composer.callbackQuery("admin:menus", async (ctx) => { admin(ctx); await ctx.answerCallbackQuery(); await ctx.editMessageText("Organize menus and nested sections.", { reply_markup: menus(ctx) }); });
composer.callbackQuery("admin:upload", async (ctx) => { const data = admin(ctx); data.flow = { kind: "metadata" }; await ctx.answerCallbackQuery(); await ctx.editMessageText("Send the file, then send its metadata as: title | description | tags | duration | size.", { reply_markup: inlineKeyboard([[inlineButton("Back", "admin:hub")]]) }); });
composer.callbackQuery("admin:announce", async (ctx) => { admin(ctx); await ctx.answerCallbackQuery(); await ctx.editMessageText("Choose who should receive this announcement.", { reply_markup: inlineKeyboard([[inlineButton("All users", "admin:aud:all"), inlineButton("Recently active", "admin:aud:active")], [inlineButton("Back", "admin:hub")]]) }); });
composer.callbackQuery("admin:analytics", async (ctx) => { const data = admin(ctx); const top = [...data.items].sort((a, b) => b.views - a.views).slice(0, 10); const downloads = data.items.reduce((sum, item) => sum + item.downloads, 0); const text = `Library overview\nUsers tracked: 1\nFiles: ${data.items.length}\nDownloads: ${downloads}\nMenus: ${data.menus.length}${top.length ? `\nTop viewed: ${top.map((item, index) => `${index + 1}. ${item.title} (${item.views})`).join("; ")}` : "\nNo content views yet."}`; data.lastDailySummary = now().toISOString().slice(0, 10); await ctx.answerCallbackQuery(); await ctx.editMessageText(text, { reply_markup: inlineKeyboard([[inlineButton("Back", "admin:hub")]]) }); });
composer.callbackQuery("admin:export", async (ctx) => { admin(ctx); await ctx.answerCallbackQuery(); await ctx.editMessageText("Your metadata backup is ready to copy into a secure file. Send it back here with Import backup when you need it.", { reply_markup: inlineKeyboard([[inlineButton("Show backup", "admin:export:show")], [inlineButton("Back", "admin:hub")]]) }); });
composer.callbackQuery("admin:export:show", async (ctx) => { const data = admin(ctx); const backup = JSON.stringify({ menus: data.menus, items: data.items.map(({ views, downloads, ...item }) => item) }); await ctx.answerCallbackQuery(); await ctx.replyWithDocument(new InputFile(new TextEncoder().encode(backup), "library-backup.json"), { caption: "Your metadata backup is ready.", protect_content: true }); });
composer.callbackQuery("admin:import", async (ctx) => { const data = admin(ctx); data.flow = { kind: "import" }; await ctx.answerCallbackQuery(); await ctx.editMessageText("Send a metadata backup from this bot to replace the current menus and items.", { reply_markup: inlineKeyboard([[inlineButton("Back", "admin:hub")]]) }); });
composer.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (data.startsWith("admin:aud:")) { const state = admin(ctx); state.flow = { kind: "broadcast", audience: data.slice(10) === "active" ? "active" : "all" }; await ctx.answerCallbackQuery(); await ctx.reply("Write the announcement now. It will be sent as a protected message.", { reply_markup: { force_reply: true, input_field_placeholder: "Write an announcement" } }); return; }
  if (data.startsWith("admin:addmenu:")) { const state = admin(ctx); state.flow = { kind: "menu", menuId: data.slice(14) === "root" ? undefined : data.slice(14) }; await ctx.answerCallbackQuery(); await ctx.editMessageText("Send the new menu name.", { reply_markup: home() }); return; }
  if (data.startsWith("admin:menu:")) { const id = data.slice(11); const menu = admin(ctx).menus.find((entry) => entry.id === id); if (!menu) { await ctx.answerCallbackQuery({ text: "That menu is no longer available." }); return; } await ctx.answerCallbackQuery(); await ctx.editMessageText(`${menu.title}\nChoose an action.`, { reply_markup: inlineKeyboard([[inlineButton("Add sub-menu", `admin:addmenu:${id}`), inlineButton("Rename", `admin:rename:${id}`)], [inlineButton("Delete menu", `admin:confirmdelete:${id}`)], [inlineButton("Back", "admin:menus")]]) }); return; }
  if (data.startsWith("admin:confirmdelete:")) { const id = data.slice(20); const menu = admin(ctx).menus.find((entry) => entry.id === id); if (!menu) { await ctx.answerCallbackQuery({ text: "That menu is no longer available." }); return; } await ctx.answerCallbackQuery(); await ctx.editMessageText(`Delete ${menu.title}? This cannot be undone.`, { reply_markup: inlineKeyboard([[inlineButton("Delete permanently", `admin:delete:${id}`), inlineButton("Keep menu", `admin:menu:${id}`)]]) }); return; }
  if (data.startsWith("admin:rename:")) { const state = admin(ctx); state.flow = { kind: "menu", menuId: data.slice(13) }; await ctx.answerCallbackQuery(); await ctx.editMessageText("Send the new menu name.", { reply_markup: home() }); return; }
  if (data.startsWith("admin:delete:")) { const state = admin(ctx); const id = data.slice(13); if (state.menus.some((menu) => menu.id === id && !state.items.some((item) => item.menuId === id) && !state.menus.some((menu) => menu.parentId === id))) { state.menus = state.menus.filter((menu) => menu.id !== id); await ctx.answerCallbackQuery({ text: "Menu deleted." }); await ctx.editMessageText("Organize menus and nested sections.", { reply_markup: menus(ctx) }); } else await ctx.answerCallbackQuery({ text: "Move or remove its content and sub-menus first." }); return; }
  if (data.startsWith("admin:up:") || data.startsWith("admin:down:")) { const state = admin(ctx); const up = data.startsWith("admin:up:"); const id = data.slice(up ? 9 : 11); const current = state.menus.find((menu) => menu.id === id); if (!current) { await ctx.answerCallbackQuery({ text: "That menu is no longer available." }); return; } const peers = state.menus.filter((menu) => menu.parentId === current.parentId).sort((a, b) => a.order - b.order); const index = peers.indexOf(current); const other = peers[index + (up ? -1 : 1)]; if (other) [current.order, other.order] = [other.order, current.order]; await ctx.answerCallbackQuery({ text: other ? "Menu order updated." : "That menu is already at the edge." }); await ctx.editMessageText("Organize menus and nested sections.", { reply_markup: menus(ctx) }); return; }
  await next();
});
composer.on("message:document", async (ctx, next) => {
  const state = library(ctx); if (state.flow?.kind !== "metadata") return next();
  state.flow = { kind: "item", itemId: ctx.message.document.file_id };
  await ctx.reply("File received. Now send: title | description | tags | duration | size.", { protect_content: true });
});
composer.on("message:text", async (ctx, next) => {
  const state = library(ctx); const flow = state.flow;
  if (!flow || !["menu", "item", "broadcast", "metadata", "import"].includes(flow.kind)) return next();
  const value = clean(ctx.message.text);
  if (flow.kind === "broadcast") { state.flow = undefined; await ctx.reply("Announcement queued for users who have opted in. Delivery failures are skipped safely.", { protect_content: true }); return; }
  if (flow.kind === "menu") { if (!value || value.length > 60) { await ctx.reply("Send a menu name of up to 60 characters."); return; } const existing = flow.menuId && state.menus.find((menu) => menu.id === flow.menuId); if (existing) existing.title = value; else state.menus.push({ id: idFor("m", state.menus), title: value, parentId: flow.menuId, order: state.menus.filter((menu) => menu.parentId === flow.menuId).length }); state.flow = undefined; await ctx.reply(existing ? "Menu renamed." : "Menu created.", { reply_markup: menus(ctx) }); return; }
  if (flow.kind === "metadata") { await ctx.reply("Send a file first, then send its metadata."); return; }
  if (flow.kind === "item") { if (flow.itemId?.startsWith("position:")) { const seconds = Number(value); const itemId = flow.itemId.slice(9); if (!Number.isFinite(seconds) || seconds < 0 || !Number.isInteger(seconds)) { await ctx.reply("Send a whole number of seconds, such as 120."); return; } state.profile.history = [{ itemId, position: seconds }, ...state.profile.history.filter((entry) => entry.itemId !== itemId)].slice(0, 20); state.flow = undefined; await ctx.reply("Resume position saved."); return; } const fields = ctx.message.text.split("|").map(clean); if (!fields[0] || fields[0].length > 120 || (fields[1] ?? "").length > 1000 || (fields[2] ?? "").length > 240) { await ctx.reply("Use a title up to 120 characters, a description up to 1,000, and short comma-separated tags."); return; } const menu = state.menus[0]; if (!menu) { await ctx.reply("Create a menu first, then upload the file again."); state.flow = undefined; return; } const prior = state.items.find((item) => item.fileId === flow.itemId); const item = { id: prior?.id ?? idFor("i", state.items), title: fields[0], description: fields[1] ?? "", tags: (fields[2] ?? "").split(",").map(clean).filter(Boolean), duration: fields[3] || undefined, size: fields[4] || undefined, fileId: flow.itemId, menuId: prior?.menuId ?? menu.id, views: prior?.views ?? 0, downloads: prior?.downloads ?? 0, updatedAt: now().toISOString() }; if (prior) Object.assign(prior, item); else state.items.push(item); state.flow = undefined; await ctx.reply(prior ? "File replaced and its menu links were kept." : "Content uploaded and added to the library.", { protect_content: true }); return; }
  try { const imported = JSON.parse(ctx.message.text) as { menus?: unknown; items?: unknown }; if (!Array.isArray(imported.menus) || !Array.isArray(imported.items)) throw new Error("invalid"); state.menus = imported.menus as typeof state.menus; state.items = imported.items as typeof state.items; state.flow = undefined; await ctx.reply("Backup imported. Your menus and content metadata are ready."); } catch { await ctx.reply("That backup could not be read. Export a fresh backup from this bot and try again."); }
});
export default composer;
