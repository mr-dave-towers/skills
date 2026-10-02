---
name: wordpress-classic-theme
description: Use when building or editing a classic (non-FSE) WordPress PHP theme — template hierarchy, template parts, the Loop, enqueueing, theme supports, menus, sidebars, custom post types. Triggers on "classic theme", "template hierarchy", "get_header", "add a page template", "enqueue", "functions.php", "child theme".
license: MIT
compatibility: opencode, claude-code, codex
metadata:
  author: "@mr-dave-towers"
  version: 1.0.0
---

# WordPress Classic Theme

Author PHP templates that survive WordPress's own rules: the hierarchy picks the
file, the Loop drives the output, and escaping is not optional. Most defects in
this stack are a template that is not in the hierarchy, an unescaped value, or a
query that runs twice.

## When to use this

Use it for a theme whose templates are `.php` and whose layout is chosen by the
template hierarchy: editing a template, adding a page template, wiring up
`functions.php`, registering a CPT or taxonomy, enqueuing assets, or converting
a design into theme markup.

Do not trigger when:

- **The theme has `templates/*.html` and `theme.json`.** That is a block theme;
  route to `wordpress-block-theme`.
- **The work is a plugin, not a theme.** CPTs, AJAX, REST, cron, and admin pages
  belong in `wordpress-plugin-development`, even when they render templates.
- **The work is a content model or a page-builder field group.** Route to
  `wordpress-acf`.
- **The request is a redesign, not an implementation.** If the deliverable is
  markup and CSS with no WordPress API involved, `frontend-design` is the better
  fit; this skill supplies the WordPress-specific part.

## Inputs

| Input | Required | How to obtain it |
| ----- | -------- | ---------------- |
| Theme location | yes | `wp-content/themes/<name>/`. Confirm whether `templates/*.html` exists; if it does, stop and re-route. |
| PHP version | no | `Requires PHP` in `style.css`. Affects what can be used. |
| Target view | yes | Which URL is being rendered. Determines the template that wins. |
| Design inputs | no | Tokens, markup, a mockup. Reuse the project's existing conventions. |
| Content | no | Real post types, taxonomies, and field names. Ask; do not assume `post` and `the_title()`. |

## Procedure

1. **Identify which template WordPress will actually load.** Walk the hierarchy
   for the target URL, from most specific to least. `page-{slug}.php` beats
   `page-{id}.php` beats `page.php` beats `singular.php` beats `index.php`. If
   the user says "I changed `single.php` and nothing happened", the answer is
   almost always that a more specific template exists — check for
   `single-{post_type}.php` and for a custom template assignment in the database.
2. **Read `functions.php` and the parent before writing anything.** Find the
   existing `add_action`/`add_filter` calls, the enqueue block, the theme
   supports, and the text domain. Match the existing prefix and structure. If
   this is a child theme, remember `get_stylesheet_directory()` (child) versus
   `get_template_directory()` (parent) — using the wrong one silently loads
   nothing or loads twice.
3. **Build the template from parts, not monoliths.** `get_header()`,
   `get_footer()`, `get_sidebar()`, and `get_template_part()` with arguments. A
   single 400-line `single.php` that inlines the header and footer cannot be
   overridden by a child theme, which is a large part of why a theme is worth
   having.
4. **Drive output with the Loop, and only one Loop per template.** `have_posts()`
   / `the_post()` for the main query. For anything else — related posts, a
   secondary list, a search inside a page — use a fresh `WP_Query` with explicit
   `post_type`, `posts_per_page`, and `no_found_rows => true`. Two `the_post()`
   loops sharing the global `$post` is a bug: the first loop's post is destroyed
   for the second.
5. **Use conditionals to vary output, not duplicated templates.** `is_singular()`,
   `is_archive()`, `is_search()`, `is_404()`, `is_front_page()`. Reach for
   `get_template_part()` with distinct part files over branching large blocks of
   markup in one template.
6. **Never hardcode a post type, taxonomy, or meta key in a template.** Read it
   from the global `$post` or from a helper, and support any post type that
   renders there. A template that assumes `post` and `post_title` breaks the
   moment a CPT is registered.
7. **Escape every dynamic value at output, with the function matching its
   context.** This is the single most important rule in the stack. Use the table
   in the escaping section below. `echo $value` is a bug even when the value
   happens to be safe today.
8. **Enqueue through `functions.php`, on `wp_enqueue_scripts`.** Never print a
   `<link>` or `<script>` tag in a template. Use `wp_enqueue_script`/
   `wp_enqueue_style` with a version from a constant, `wp_localize_script` for
   data (not for behaviour), and `wp_add_inline_script` for a short config
   object. If the value is not a string (an array, a boolean), do not enqueue it
   at all — serialise it and skip the request.
9. **Declare what the theme supports.** `title-tag`, `post-thumbnails`,
   `custom-logo`, `html5` (with the full argument array, not a bare string —
   a bare `'html5'` resets previously declared `html5` features and is a
   well-known footgun), `automatic-feed-links`, `align-wide`, `responsive-embeds`,
   `editor-styles`. A theme that supports the wrong set of features gets editor
   output it cannot style.
10. **Register CPTs and taxonomies on `init`,** with `show_in_rest => true` so
    they work in the block editor and the REST API. `public`, `has_archive`,
    `rewrite`, `supports`, and `menu_icon` are the arguments that matter. Get
    these right on first registration: a rewrite slug change later is a
    redirect problem.
11. **Verify against the real hierarchy.** `php -l` on every file touched, then
    load the actual URLs. Confirm the parent query is untouched, the 404 works,
    the search works, and the template hierarchy resolves as intended.

## Escaping by context

| Value | Function | Notes |
| ----- | -------- | ----- |
| Text in HTML | `esc_html()` | The default for anything from the database |
| Attribute value | `esc_attr()` | `alt`, `title`, `data-*`, `class` |
| URL in an attribute | `esc_url()` | `href`, `src`, `action` |
| URL for storage or redirect | `esc_url_raw()` | Not for output |
| Allowed HTML from a WYSIWYG field | `wp_kses_post()` | The whitelist an editor should have |
| Translated string | `esc_html__()` / `esc_attr__()` | Escaping and translation in one call |
| Post title as a URL-safe slug | `sanitize_title()` | Rarely right; prefer `get_permalink()` |
| Integer | `absint()` or `intval()` | For IDs and counts |
| Key | `sanitize_key()` | For array keys and query vars |
| Text input | `sanitize_text_field()` | For `$_POST` values |
| Email | `sanitize_email()` | |

Never escape on input and then again on output. Escape on input for storage
where the value needs normalising; escape on output, every time, for the context
it lands in.

## Custom post types

Register on `init`. These arguments are the ones that cause trouble when
missing:

```php
add_action( 'init', function () {
	register_post_type( 'case_study', array(
		'label'       => __( 'Case Studies', 'theme-text-domain' ),
		'public'      => true,
		'has_archive' => true,
		'show_in_rest' => true,
		'rewrite'     => array( 'slug' => 'case-studies' ),
		'supports'    => array( 'title', 'editor', 'thumbnail', 'excerpt', 'revisions' ),
		'menu_icon'   => 'dashicons-portfolio',
	) );
}, 10 );
```

- `show_in_rest => true` is required for the block editor and for REST reads. Its
  absence produces a "not editable" experience with no error message.
- `has_archive => true` needs an archive template (`archive-case_study.php`) or it
  falls back to `index.php`, which is usually a confusing 404-adjacent experience.
- `rewrite` slug is permanent. Changing it later needs redirects.
- Set `public => false` and `publicly_queryable => false` for internal types
  (a `lead`, a `log`) that should never be a URL.
- Register taxonomies with `show_in_rest => true` too, and give them a
  `rewrite` slug and a `has_archive`-style archive template.

## Guardrails

- **Never output an unescaped dynamic value.** If a value reaches HTML, it goes
  through the context-appropriate escape function. No exceptions for "trusted"
  data — a value is only as trusted as the least-privileged role that can set it.
- **Never nest `the_post()` loops on the global query.** Use `WP_Query` with
  `no_found_rows => true` for secondary queries, and restore the global post
  with `wp_reset_postdata()` if you used `setup_postdata()`.
- **Never print `<link>` or `<script>` tags in a template.** Enqueue in
  `functions.php`. Inline scripts need `wp_add_inline_script` with a proper
  strategy, not a raw tag.
- **Never add a second `while ( have_posts() )` to fix a page that renders
  nothing.** The parent query is already correct; the template is in the wrong
  place in the hierarchy or the `post_type` filter is wrong. Diagnose the
  hierarchy.
- **Never hardcode `post` or `the_title()` in a template** that renders more than
  one post type.
- **Never use `add_theme_support( 'html5', 'search-form' )` alone.** A single
  string resets the whole `html5` feature set. Pass the full array.
- **Never edit the parent theme** to fix a site. Use a child theme; say so if the
  user is about to edit a core-default theme like Twenty Twenty-Five.
- **Never assume a rewrite slug is changeable.** A slug change is a redirect
  problem; call it out before making it.
- **Never register a CPT on a page-load or admin-page hook.** `init` only —
  registering later means the post type is missing from the admin menu and the
  REST index on that request.
- **Never leave a `?>` at the end of a PHP file.** Omitting it prevents stray
  whitespace breaking headers and redirects.

## Examples

**Input:** "add a page template for the About page with a full-width intro"

**Output:** a `page-{slug}.php` in the theme root, assigned via the template name
in the file header, with `Template Name` present so it appears in the dropdown:

```php
<?php
/**
 * Template Name: About — Intro
 * Template Post Type: page
 */

get_header();
?>

<main id="primary" class="site-main site-main--about">
	<?php
	while ( have_posts() ) :
		the_post();
		?>
		<article <?php post_class(); ?>>
			<div class="intro">
				<h1 class="intro__title"><?php the_title(); ?></h1>
				<div class="intro__body">
					<?php the_content(); ?>
				</div>
			</div>
		</article>
		<?php
	endwhile;
	?>
</main>

<?php
get_footer();
```

The report notes: `Template Name` is what makes it selectable, `Template Post
Type` scopes it to pages, the template only applies to the page with slug
`about`, and the front page requires `front-page.php` to override it — a
template assigned to the front page is ignored unless the theme has a
`front-page.php`.

**Why it matters:** The last point is the one that wastes the most time. A page
template that appears to do nothing on the front page is not a bug in the
template.

---

**Input:** "the sidebar shows the same posts twice"

**Output:** almost always a nested `the_post()` loop or a missing
`wp_reset_postdata()`. Read the template, find the second loop, convert it to a
`WP_Query` with `no_found_rows => true` and explicit `post_type`, and add
`wp_reset_postdata()` after any `setup_postdata()` call. Do not fix it by
changing the query args — that hides the state corruption and the second loop
still gets the wrong `$post`.

**Why it matters:** Symptom-level fixes to a global-state problem move the bug
somewhere less obvious and leave the real defect in place.

## References

- [Template hierarchy and escape reference](./references/hierarchy-and-escaping.md)
  — the full resolution order per view type, and the escape function for every
  output context. Read when adding a template or when a template is not loading.
