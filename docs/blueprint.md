# Private Content Library Bot — Bot specification

**Archetype:** content

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot that allows admins to upload and organize files into nested menus while providing users with browsing, search, bookmarking, media resuming, and metadata viewing capabilities. Admins receive analytics and content management notifications in a dedicated chat.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Content Admins
- End Users

## Success criteria

- Admins can upload and organize content into nested menus with ease
- Users can browse, search, bookmark, and resume media seamlessly
- Analytics are accurately tracked and reported to the admin chat

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu with browsing options and quick tips
- **Search** (button, actor: user, callback: search:init) — Open global search interface for titles/descriptions/tags
  - inputs: search query
  - outputs: paged search results
- **Favorites** (button, actor: user, callback: favorites:view) — Access user's bookmarked items
- **Recently Viewed** (button, actor: user, callback: history:view) — Show user's recently accessed content

## Flows

### content_browsing
_Trigger:_ main_menu

1. Display main menu buttons
2. Navigate sub-menus via inline buttons
3. View item details with Play/Download options

_Data touched:_ Menu, Sub-menu, Item

### search_flow
_Trigger:_ search:init

1. Display search input prompt
2. Process query and show paged results
3. Allow filtering by tags

_Data touched:_ Item, Tag

### admin_broadcast
_Trigger:_ admin:announce

1. Admin selects broadcast audience
2. Compose message with ForceReply input
3. Send announcement to users

_Data touched:_ Broadcast, User

### analytics_reporting
_Trigger:_ admin:analytics

1. Fetch total users and files
2. Generate top 10 viewed content list
3. Display download stats and menu analytics

_Data touched:_ Analytics, Menu, Item

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Menu** _(retention: persistent)_ — Top-level content category with ordered items
  - fields: id, title, order, items
- **Item** _(retention: persistent)_ — Content entry with metadata and file/link references
  - fields: id, title, description, file_id, link, duration, size, tags
- **User** _(retention: persistent)_ — User profile with browsing history and preferences
  - fields: id, bookmarks, history, last_seen
- **Analytics** _(retention: persistent)_ — Usage statistics for content tracking
  - fields: user_id, item_id, views, downloads, timestamp

## Integrations

- **Telegram** (required) — Bot API messaging and file management
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Create/Edit/Delete menus/sub-menus
- Upload/replace files with metadata updates
- Broadcast announcements to users
- Export/import metadata backups

## Notifications

- Admin receives content upload confirmation
- Admin gets analytics summary daily
- User gets announcement broadcasts

## Permissions & privacy

- Files only accessible through bot UI with protected content
- User history and bookmarks stored privately
- Analytics deduplicated by user+item+session

## Edge cases

- File replacement preserves existing menu links
- Protected content bypass attempts
- Search query with no results

## Required tests

- Verify nested menu navigation with Back/Home buttons
- Test media resuming across sessions
- Validate admin broadcast reaches all users

## Assumptions

- Admin uses single Telegram chat for control
- Drag-and-drop simulated via Move Up/Down buttons
- File replacement maintains functional links
