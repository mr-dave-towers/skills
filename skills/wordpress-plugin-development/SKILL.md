---
name: wordpress-plugin-development
description: Use when writing, reviewing, or debugging a WordPress PHP plugin — activation hooks, custom post types, admin pages and settings, REST API routes, AJAX handlers, cron jobs, nonces, capability checks, and uninstall behaviour. Triggers on "create a plugin", "add a REST endpoint", "admin settings page", "AJAX handler", "cron job", "capability check".
license: MIT
compatibility: opencode, claude-code, codex
metadata:
  author: "@mr-dave-towers"
  version: 1.0.0
---

# WordPress Plugin Development

Write plugins that are upgrade-safe, uninstall-clean, and safe when every input
is hostile. WordPress gives a plugin enormous reach — every hook, every request,
every user — so the plugin's own defaults must be the secure ones.

## When to use this

Use it for code that ships in a plugin: admin screens, settings, REST endpoints,
AJAX, scheduled tasks, custom post types and taxonomies, integrations with
external services, and shortcodes.

Do not trigger when:

- **The work belongs in a theme.** Templates, `functions.php`, and enqueueing in
  a theme are theme concerns; route to `wordpress-classic-theme`. The line is
  capability: a plugin runs on every page of every site and outlives the theme,
  so anything presentation- or layout-specific belongs in the theme.
- **The theme is a block theme and the change is `theme.json` or a template.**
  Route to `wordpress-block-theme`.
- **The work is a content field group.** Route to `wordpress-acf`.
- **The code is a one-off fix in a template.** A plugin is the wrong home for a
  three-line patch; say so.

## Inputs

| Input | Required | How to obtain it |
| ----- | -------- | ---------------- |
| Feature | yes | What the plugin does, in user terms. |
| Who can use it | yes | Every visitor, logged-in users, or a specific role. Determines every capability check. |
| Data | no | What is stored, where, and whether it is sensitive. Determines sanitisation and uninstall. |
| Integration | no | External API, webhook, or other plugin. Determines nonce, verification, and rate handling. |
| Environment | no | WordPress and PHP versions, multisite or single site. |
| Existing plugin | no | If extending one, read its structure, prefix, and deactivation behaviour first. |

## Procedure

1. **Read the surrounding plugin first.** Match its prefix, its file layout, its
   hook naming, and its escaping conventions. A second plugin in the same
   directory with a different style is worse than one consistent style.
2. **Decide the capability model before writing any handler.** Every entry point
   — admin page, AJAX action, REST route, cron callback, shortcode — needs a
   named answer to "who may do this". Default to the most restrictive. If the
   answer is "anyone", say why in the code with a comment and in the report.
3. **Register everything on `init`.** Post types, taxonomies, REST routes, and
   blocks. Registering later means they are missing on the request where they
   were needed. Nothing user-facing may be registered on a page-specific hook.
4. **Add the capability check to every entry point, plus a nonce for anything
   that changes state.** Capability is authorisation: "may this role do this".
   The nonce is a CSRF token: "is this request from a page this user loaded".
   Both are required for a state-changing endpoint. A nonce is not a security
   boundary on its own and never replaces a capability check.
5. **Sanitise on input, escape on output, and do both deliberately.** A request
   handler's job is: read raw → `sanitize_text_field`/`absint`/`sanitize_key` →
   store. A template's job is: read → `esc_html`/`esc_attr`/`esc_url` → print.
   Whitelist on validation (`in_array`, a schema), never blacklist.
6. **Use the API that already solves the problem.** `register_setting` for
   options, `wp_schedule_event` for recurring work, transients for cache,
   `WP_Error` for failures, `wp_send_json_error` for AJAX, `WP_REST_Response`
   for REST. Hand-rolled equivalents are where security bugs live.
7. **Make it uninstall cleanly.** `uninstall.php` that deletes the options and
   post meta the plugin created, and only those. Do not delete user content.
   Delete scheduled events on deactivation. A plugin that leaves rows in
   `wp_options` after removal is a bug report waiting to happen.
8. **Version the data, not just the code.** Store an options array with a
   `version` key and provide an upgrade routine. Settings stored as loose
   individual options cannot be migrated; a renamed option key becomes a
   permanently unread setting.
9. **Handle failure the way the caller can act on it.** Every handler either
   succeeds or returns a specific `WP_Error` with an actionable message. A silent
   `false` return produces a UI that does nothing and no way to find out why.
10. **Verify with the debug log on.** `WP_DEBUG` and `WP_DEBUG_LOG` enabled, then
    exercise every entry point: allowed role, denied role, no nonce, bad nonce,
    bad input, and the success path. Then deactivate and uninstall, and confirm
    nothing is left behind.

## Nonce and capability

| Surface | Capability | Nonce | Notes |
| ------- | ---------- | ----- | ----- |
| Admin page render | `current_user_can( 'manage_options' )` | No | Read-only |
| Admin form submit | Capability | Yes — `check_admin_referer()` | Nonce field in the form |
| `wp_ajax_` handler | Capability | Yes — `check_ajax_referer()` | The action name must match the nonce action |
| `wp_ajax_nopriv_` handler | `current_user_can( 'read' )` or public | Yes | Almost always a mistake; justify it |
| REST route | `permission_callback` | Not required — session auth is used | `permission_callback` is **mandatory**; return a `WP_Error` or `false`, never an empty function |
| Cron callback | Capability check too | No | Cron runs as no user; re-check inside |
| Shortcode | No check (public) | No | Only render; never mutate state |
| Form handler (`admin_post_`) | Capability | Yes | `admin_post_nopriv_` only for public forms |

`check_ajax_referer()` returns `false` and dies on failure — it is not a boolean
to branch on. `wp_verify_nonce()` returns `1`/`2` or `false`; treat anything not
`1` as a failure.

## Storage and uninstall

| Data | Where | Uninstall |
| ---- | ----- | --------- |
| Settings | One option, namespaced, versioned | Delete the whole option |
| Plugin-owned post meta | `_prefix_meta_key` keys | Delete by key pattern, scoped to the meta key, not by post type |
| Custom post types | `wp_posts` | Do not delete user content; offer it on uninstall |
| Cache | Transients | Delete the plugin's own transients |
| Scheduled events | `wp_options` cron array | `wp_clear_scheduled_hook()` on deactivation |
| Files | Uploads directory | Delete only files the plugin created, in its own subdirectory |

Prefix every option name, meta key, cron hook, REST namespace, script handle,
CSS class, and shortcode with the plugin prefix. Unprefixed names collide with
the next plugin and are the most common cause of a "works until another plugin is
activated" bug.

## Guardrails

- **Never trust input.** Every `$_POST`, `$_GET`, and `$_REQUEST` value is
  hostile. Sanitise it, validate it against a whitelist, and check the nonce.
- **Never rely on the nonce as authorisation.** A nonce proves origin, not
  permission. The capability check is the authorisation.
- **Never register a REST route without a `permission_callback`.** It is required
  since WordPress 5.5, and a missing one makes the route public — the most
  common REST vulnerability.
- **Never `echo` unescaped output.** Use `esc_html`, `esc_attr`, `esc_url`, or
  `wp_kses` by context. Unslashing without escaping is not a substitute.
- **Never run a query with concatenated input.** Use `$wpdb->prepare()` for
  `wpdb`, or a `WP_Query`/`WP_Meta_Query` with a declared meta key.
- **Never put a file path, class name, or function name from user input into a
  `require`/`include` or an `unserialize`.** Both are remote code execution.
- **Never use `update_option` with a loose, unnamespaced key**, and never store
  options without a version field. Name collisions and unmigratable settings are
  both permanent.
- **Never leave a plugin's data behind after uninstall.** `uninstall.php` deletes
  what the plugin created — and only what the plugin created.
- **Never deactivate-schedule a hook that `deactivation` does not clear.** Cron
  events that survive deactivation keep running.
- **Never write a plugin that only works with `WP_DEBUG` off.** If the plugin
  only appears to work when notices are hidden, it is emitting notices on every
  request. Test with debug on.
- **Never check `is_admin()` to decide whether to run front-end logic.** It is
  true for AJAX and REST too. Use the specific hook.

## Examples

**Input:** "add a settings page to the plugin that stores an API key"

**Output:** a capability-gated admin page, a registered setting with a sanitising
callback, and an uninstall handler:

```php
add_action( 'admin_menu', function () {
	add_options_page(
		__( 'My Plugin', 'my-plugin' ),
		__( 'My Plugin', 'my-plugin' ),
		'manage_options',
		'my-plugin',
		'my_plugin_render_settings'
	);
} );

add_action( 'admin_init', function () {
	register_setting(
		'my_plugin',
		'my_plugin_settings',
		array(
			'type'              => 'object',
			'sanitize_callback' => 'my_plugin_sanitize_settings',
			'default'           => array( 'version' => 1 ),
		)
	);
	add_settings_section( 'my_plugin_main', __( 'Connection', 'my-plugin' ), '__return_empty_string', 'my-plugin' );
	add_settings_field(
		'api_key',
		__( 'API key', 'my-plugin' ),
		'my_plugin_render_api_key',
		'my-plugin',
		'my_plugin_main'
	);
} );

function my_plugin_sanitize_settings( $input ) {
	$output = is_array( $input ) ? $input : array();
	return array(
		'version' => 1,
		'api_key' => isset( $output['api_key'] )
			? sanitize_text_field( $output['api_key'] )
			: '',
	);
}
```

The report names: the `manage_options` capability on both the menu and the
form, the nonce that `settings_fields()` emits, the `sanitize_callback` as the
single write path, the API key stored in a namespaced option (not a loose
`api_key`), and that the key is never echoed back into `value=` — the field
renders a masked placeholder instead, because options pages render the value into
the DOM.

**Why it matters:** The nonce and the capability come from the framework rather
than from hand-written code, and the value-not-echoed detail is the one that is
easy to miss and impossible to un-notice afterwards.

---

**Input:** "call our API when a post is published"

**output:**

```markdown
## Implementation

Three pieces: a cron job for the request, an `init` registration, and a
deactivation hook that clears the schedule.

**Trigger** — `transition_post_status`, not `save_post`. `save_post` fires on
every autosave, revision, and import, which means duplicate API calls and a
retry storm.

**Capability** — the cron callback runs with no user, so the capability check
inside it is `current_user_can( 'publish_posts' )` against the author, and it
returns early when the post type is not `post`. This is the one place a cron
callback needs a check.

**Failure** — a non-2xx response is logged and the transient is not set, so the
next scheduled run retries. A transient of `my_plugin_last_push` records the
last success for the admin notice. No unbounded retry loop: a 5xx from a remote
API is retried on the next 15-minute tick, not in a tight loop.

**Deactivation** — `wp_clear_scheduled_hook( 'my_plugin_push_post' )`, otherwise
the job keeps firing for a site that no longer has the plugin active.

**Uninstall** — `uninstall.php` deletes the `my_plugin_settings` option and the
`my_plugin_last_push` transient. Post content is untouched.
```

**Why it matters:** It picks `transition_post_status` over `save_post`, handles
the missing user in cron, and states the retry and deactivation behaviour — the
three things that separate a plugin that works from one that spams an API and
never cleans up.
