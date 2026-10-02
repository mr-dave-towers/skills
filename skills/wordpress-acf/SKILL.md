---
name: wordpress-acf
description: Use when building WordPress features with Advanced Custom Fields — custom post types, field groups, field location rules, repeaters, relationship fields, options pages, conditional logic, and front-end rendering. Triggers on "ACF", "custom fields", "field group", "repeater field", "get_field", "options page", "CPT".
license: MIT
compatibility: opencode, claude-code, codex
metadata:
  author: "@mr-dave-towers"
  version: 1.0.0
---

# WordPress And ACF

Model content as a content model, not as a pile of meta keys. ACF makes the field
group easy and the data model easy to get wrong, so the skill's work is the
model: what is a post type, what is a field, what is a relationship, and what is
a repeater.

## When to use this

Use it when content is structured and needs a UI for editors: custom post types
with fields, field groups on posts or pages or users, repeaters, relationships,
options pages, or templates that read `get_field()`.

Do not trigger when:

- **The theme is a block theme and the content should be core blocks.** If
  editors are happy with the block editor, use core blocks and skip ACF
  entirely; a field group is a maintenance liability with no upside.
- **The work is template markup with no fields.** Route to
  `wordpress-classic-theme` or `wordpress-block-theme`.
- **The work is a plugin's admin/REST/AJAX surface.** Route to
  `wordpress-plugin-development`; an ACF skill still governs the field layer if
  one is involved.
- **The content is a handful of one-off values.** Post meta read directly is
  simpler than a field group for two fields. ACF earns its overhead on
  structured, editor-facing content.

## Inputs

| Input | Required | How to obtain it |
| ----- | -------- | ---------------- |
| Content model | yes | What the editors are managing and what it means. Get this before touching fields. |
| Post types | yes | Existing, or new. New ones need registering with `show_in_rest => true`. |
| Field location | yes | Which post type, which template, which page. A group with the wrong location rule is invisible to editors. |
| Return format | yes | Per field, and deliberate. It changes the shape returned by `get_field()`. |
| Existing fields | no | Read before adding. Field renaming breaks stored data. |
| ACF version | no | ACF 5.8+ vs 6.x differ on repeater and relationship behaviour. ACF Pro is required for repeaters, relationships, and flexible content. |

## Procedure

1. **Model the content before the fields.** Name the post type, list the things
   an editor fills in, and mark which are single values, which are repeating
   collections, and which point at other content. If everything is a scalar
   field, the model is probably wrong — real content has structure.
2. **Register the post type first, on `init`, with `show_in_rest => true`.**
   Fields attach to a post type; a post type registered after the field group's
   location rule, or without `show_in_rest`, produces fields that exist in the
   database and nowhere in the editor. Also decide the rewrite slug and whether
   it has an archive.
3. **Create the field group in the ACF admin, then export the JSON into the
   theme or plugin.** Local JSON is the source of truth: it is version
   controlled, reviewable in a diff, and portable between environments. Configure
   the path with `acf/settings/save_json` (write point) and
   `acf/settings/load_json` (read point), pointing both at the theme or plugin
   directory. Never hand-edit a field group JSON and then re-save it in the admin
   — the next save wins.
4. **Choose the return format per field, deliberately.** `get_field()` returns a
   different shape per format, and the choice is baked into every template that
   reads the field. Choose it once, write it down, and never change it on a field
   that already has data. Page/relationship fields return a `WP_Post` object;
   image returns an array with `ID`, `url`, `sizes`; `url` returns a string.
5. **Read fields with an explicit post ID in loops and in secondary queries.**
   `get_field( 'field_name', $post_id )` — the single-argument form silently
   reads the wrong post inside `while ( have_posts() )` variations and inside
   `get_posts()` loops. This is the most common ACF bug.
6. **Use the repeater only for genuinely variable-length collections.** A repeater
   with a fixed number of rows is a set of individual fields. Repeaters are slow
   and cannot be required in a useful way, so a fixed-count "repeater" is a
   modelling error. Read them with `have_rows()` / `the_row()` or
   `get_field()` returning the rows array, and always pass the row as the
   `$post_id` when reading sub-fields.
7. **Model relationships as relationships, not as stored IDs.** Use a relationship
   or post-object field for "this page relates to these posts", and query it
   forward. Do not store a comma-separated list of IDs in a text field and
   `explode()` it — the posts get deleted and the data lies.
8. **Set field location precisely.** Post type, post template, page template, or
   a specific page via a rule. "Post type is post AND page template is X" is
   usually wrong for a feature that spans both. A field group attached to
   `post` when the content is a CPT is invisible, not an error — tell the user
   to check the location tab first when fields are missing.
9. **Escape on output by return format, not by intuition.** A WYSIWYG field is
   `wp_kses_post()`. An image is `wp_get_attachment_image( $image['ID'], 'size' )`,
   not a raw `<img src="$image['url']">` with no dimensions. A URL is `esc_url()`.
   A repeater sub-field is escaped the same way as a top-level one.
10. **Verify the real thing.** Create a post in the editor, save it, then read the
    fields from a template or `wp eval`. Check the REST response
    (`/wp-json/wp/v2/<post_type>?context=edit`) to confirm the fields are exposed
    and named as expected. Export the field group JSON and confirm it is in the
    repository.

## Reading fields

| Need | Use | Watch out |
| ---- | --- | --- |
| One field, one post | `get_field( 'key', $post_id )` | Always pass the ID |
| Every field on a post | `get_fields( $post_id )` | Much faster than N calls |
| Inside a repeater | `get_field( 'sub_key', $row )` | The second argument is the row, not the post |
| Sub-field of a sub-field | `get_field( 'sub_sub', $row )` | Same rule, one level deeper |
| Loop a repeater | `have_rows( 'key', $post_id )` / `the_row()` | Set `$post_id` from the row, not the outer post |
| A relationship's posts | `get_field( 'key', $post_id )` then a `WP_Query` on the IDs | The IDs are a hint; query for the full posts |
| An options page value | `get_field( 'key', 'option' )` | The second argument is the string `option` |
| A user's field | `get_field( 'key', $user_id )` | Not `$_GET['user_id']` unvalidated |

## Guardrails

- **Never call `get_field()` without a post ID inside a loop.** The
  single-argument form inside a secondary query reads the wrong post. Pass the ID
  explicitly everywhere except a plain `while ( have_posts() )` in the singular
  template.
- **Never use a repeater for a fixed number of rows.** Use individual fields. A
  fixed-count repeater is unvalidatable and slow.
- **Never store related post IDs in a text field.** Use a relationship or
  post-object field so the link survives deletion and is queryable.
- **Never hand-edit a field group JSON and then re-save the group in the admin.**
  The admin save overwrites the file. Edit in the admin, or edit the file and
  import it, but not both.
- **Never rename a field that has data.** ACF stores data by field name. Renaming
  orphans every value. Add a new field and migrate with an `acf/update_field`
  routine, or an `after_setup_theme` one-off.
- **Never expose a field that should be private in a REST response.** Custom
  fields on a post type with `show_in_rest => true` are returned by the REST API
  to anyone who can read the post. Do not put a secret in an ACF field.
- **Never echo a field without escaping for its type.** `get_field()` output is
  still user-controlled content; the WYSIWYG editor is not a security boundary.
- **Never write `get_field()` in a template as a substitute for the Loop.** Use
  the Loop for the queried content and `get_field()` for the fields on it.
- **Never leave a field group in the database only.** Export the JSON to the
  repository. A database-only group cannot be reviewed, deployed, or reproduced.
- **Never add ACF Pro features (repeater, relationship, flexible content) to a
  project without confirming Pro is licensed.** The fields silently do not
  appear in the free version.

## Examples

**Input:** "I need a repeatable list of testimonials on case study pages"

**output:**

````markdown
## Model

Post type `case_study` (already registered, `show_in_rest => true`). One
testimonial is an item with: quote (textarea), author name (text), author role
(text), and photo (image, return format `array`). The number varies per case
study, so this is a repeater, not four fields.

**Field group**
| Field | Type | Name | Return | Notes |
| ----- | ---- | ---- | ------ | ----- |
| Repeater | repeater | `testimonials` | array | Rows, 1–20 |
| → Field | textarea | `quote` | text | Required |
| → Field | text | `author_name` | text | Required |
| → Field | text | `author_role` | text | |
| → Field | image | `author_photo` | array | Returns `ID`, `url`, `sizes` |

Location: post type is `case_study`. JSON exported to
`acf-json/group_testimonials.json`.

**Template**
```php
<?php if ( have_rows( 'testimonials', get_the_ID() ) ) : ?>
	<ul class="testimonials">
		<?php
		while ( have_rows( 'testimonials', get_the_ID() ) ) :
			the_row();
			$photo = get_sub_field( 'author_photo' );
			?>
			<li class="testimonial">
				<blockquote class="testimonial__quote">
					<?php echo wp_kses_post( get_sub_field( 'quote' ) ); ?>
				</blockquote>
				<footer class="testimonial__author">
					<?php if ( $photo ) : ?>
						<?php
						echo wp_get_attachment_image(
							$photo['ID'],
							'thumbnail',
							false,
							array( 'class' => 'testimonial__photo', 'alt' => '' )
						);
						?>
					<?php endif; ?>
					<span class="testimonial__name">
						<?php echo esc_html( get_sub_field( 'author_name' ) ); ?>
					</span>
					<span class="testimonial__role">
						<?php echo esc_html( get_sub_field( 'author_role' ) ); ?>
					</span>
				</footer>
			</li>
		<?php endwhile; ?>
	</ul>
<?php endif; ?>
```

**Notes**
- `wp_get_attachment_image()` is used instead of a raw `<img>` so the image is
  lazy-loaded, sized, and given a `srcset` by WordPress.
- The repeater is read with an explicit post ID, so this is safe to drop into a
  secondary query loop.
- JSON is in the repository, so a second environment gets the same fields.
````

**Why it matters:** It justifies the repeater (variable count), fixes the
`author_photo` rendering to the array return format, keeps the JSON under
version control, and passes the post ID into the repeater read — the four things
that go wrong in almost every ACF build.
