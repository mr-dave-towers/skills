# Template hierarchy and escaping

Read this when adding a template to a classic theme, when a template is not
loading, or when deciding which escape function a value needs.

## Resolution order

WordPress picks the first file that exists, top to bottom, for the current URL.
There is no merge — exactly one template file is loaded, plus its parts.

### Single post

```text
single-{post_type}-{slug}.php
single-{post_type}-{id}.php
single-{post_type}.php
single.php
singular.php
index.php
```

### Single page

```text
page-{slug}.php
page-{id}.php
page-{template}.php     # for a custom template assigned in the editor
page.php
singular.php
index.php
```

### Archive (post type, date, taxonomy, author)

```text
archive-{post_type}.php
{taxonomy}-{term}.php
{taxonomy}-{term}-{slug}.php
{taxonomy}.php
category-{id}.php
category-{slug}.php
category.php
tag-{id}.php
tag-{slug}.php
tag.php
taxonomy.php
author-{nicename}.php
author.php
date.php
archive.php
index.php
```

Note the asymmetry: the front page and the posts page have their own, and a
custom template assigned in the editor uses `page-{template}.php` — the template
slug, not the post slug. Two templates with the same slug for two purposes is a
collision that silently serves the wrong one.

### Front page and home

```text
front-page.php     # static front page, or the posts page if no static one is set
home.php           # the blog posts index, only when a static front page is set
index.php          # the ultimate fallback; must exist
```

### Other

```text
search.php
404.php
```

### Conditional tags for the loaded template

```text
is_front_page()      is_home()         is_singular()
is_single()          is_page()         is_attachment()
is_archive()         is_category()     is_tag()
is_tax()             is_author()       is_date()
is_search()          is_404()          is_paged()
is_embed()           is_sticky()
```

`is_singular()` is true for `is_single()`, `is_page()`, and
`is_attachment()`. `is_archive()` covers categories, tags, taxonomies, authors,
and dates — it is broader than "post type archive".

## Diagnosing "my template did not load"

Work down this list; the answer is almost always in the first three.

1. A more specific file exists. `ls templates/ single-*.php page-*.php` — for a
   block theme, also check for a customised template in the database.
2. A custom template is assigned in the editor, and the file is named for the
   template slug, not the page slug.
3. The front page is special. A page template assigned to the front page is
   ignored unless the theme has `front-page.php`.
4. The file is in the wrong directory, or named with wrong case.
5. It is a child theme and the parent file is being loaded first.
6. Caching. Only after the above.

## Escaping by output context

| Context | Function | Example |
| ------- | -------- | ------- |
| HTML text | `esc_html()` | `<p><?php echo esc_html( $title ); ?></p>` |
| HTML attribute | `esc_attr()` | `alt`, `title`, `class`, `data-*` |
| URL in markup | `esc_url()` | `href`, `src`, `action` |
| URL for storage, redirect, or a query arg | `esc_url_raw()` | `wp_safe_redirect( esc_url_raw( $url ) )` |
| Post content from a WYSIWYG editor | `wp_kses_post()` | The post content allowlist |
| Arbitrary subset of HTML | `wp_kses( $value, $allowed )` | A stored rich field |
| Translated + escaped HTML text | `esc_html__()` | `echo esc_html__( 'Read more', 'theme' )` |
| Translated + escaped attribute | `esc_attr__()` | `echo esc_attr__( 'Title', 'theme' )` |
| Translated, no escaping needed | `__()` / `_e()` | Only inside a `printf`/`sprintf` |
| Integer | `absint()` | IDs, counts |
| Float | `floatval()` | |
| Key | `sanitize_key()` | Query vars, array keys |
| Text input | `sanitize_text_field()` | On input |
| Email | `sanitize_email()` | On input |
| Slug | `sanitize_title()` | Only for building a new slug |
| SQL | `$wpdb->prepare()` | Always, for custom queries |
| SQL identifiers | `$wpdb->prepare()` + backticks | Table and column names cannot be parameterised; whitelist them |

## The escaping rules that matter

- **Escape at output, always.** Sanitising on input does not mean the value is
  safe to print: an editor with `unfiltered_html`, a value written by a migration
  script, or a value that was sanitised for a different context is not escaped
  for this one.
- **Do not double-escape.** If a value is escaped when stored, do not escape it
  again on output — `&amp;` becomes `&amp;amp;`. Sanitise on input for storage,
  escape on output, and do not do both for the same reason.
- **The right function for the context.** `esc_html()` inside an attribute is the
  wrong tool even though it sometimes looks fine. `esc_url()` strips
  `javascript:` and similar schemes; `esc_html()` does not.
- **Never echo a whole array.** `print_r` and `var_dump` in a template leak
  post meta, and sometimes credentials.

## Template parts

```php
get_header();
get_header( 'masthead' );   // header-{name}.php
get_footer();
get_sidebar();
get_sidebar( 'related' );   // sidebar-{name}.php
get_template_part( 'template-parts/content', get_post_type() );
get_template_part( 'template-parts/content', 'page' );
get_search_form();
comments_template();
wp_body_open();
```

`get_template_part()` with a slug loads `{slug}.php` or `{slug}-{name}.php` —
a real, overridable extension point. Prefer it over a large inline
`if ( is_archive() ) { … } else { … }` in one template.
