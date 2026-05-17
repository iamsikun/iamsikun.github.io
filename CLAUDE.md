# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Personal academic website for Sikun Xu, deployed to GitHub Pages at https://iamsikun.github.io. It is a fork of the [academicpages](https://academicpages.github.io/) template, which itself is built on the **Minimal Mistakes** Jekyll theme (see `package.json` and `_sass/`). Most of the directory layout, includes, and SCSS come from that upstream theme — only the content (`_pages/`, `_config.yml`, `_data/navigation.yml`, custom assets) is meaningfully site-specific.

## Common commands

```bash
# Install Ruby gem dependencies (uses Gemfile.lock)
bundle install

# Run the site locally — serves at http://localhost:4000
bundle exec jekyll serve --config _config.yml,_config.dev.yml

# Or a plain build for production
bundle exec jekyll build
```

`_config.dev.yml` is a development override layered on top of `_config.yml` (disables analytics, switches Sass to expanded output, points URL at localhost). Jekyll does **not** reload `_config.yml` on file changes — restart the server after editing either config.

The `Gemfile` lists `hawkins` (a livereload variant exposing `jekyll liveserve`), but the Hawkins servlet currently crashes on every request with `NoMethodError: undefined method 'key?' for nil` against Jekyll 3.10 + current Ruby/WEBrick on this machine. Use plain `jekyll serve` and reload manually until that's fixed upstream.

JS bundling (rarely needed; only if editing files under `assets/js/_main.js` or `assets/js/plugins/`):

```bash
npm install
npm run build:js   # uglifies plugins + _main.js → assets/js/main.min.js
npm run watch:js   # rebuild on change
```

## Content architecture

Jekyll **collections** are the primary unit of content. They are declared in `_config.yml` under `collections:` and each has its own top-level folder:

- `_publications/` → `/publications/:path/`
- `_talks/` → `/talks/:path/` (uses the custom `talk` layout in `_layouts/talk.html`)
- `_teaching/` → `/teaching/:path/`
- `_portfolio/` → `/portfolio/:path/`
- `_posts/` and `_drafts/` → blog posts
- `_pages/` → standalone pages (NOT a collection — included via `include: [_pages]` in `_config.yml`). The homepage is `_pages/about.md` (it sets `permalink: /`).

Per-collection layout/sidebar defaults live in the `defaults:` block of `_config.yml`. Most collections default to `layout: single`; `_talks` uses `layout: talk`.

Site chrome:
- `_data/navigation.yml` — the top nav links (currently just "Industry Experience" and a CV link).
- `_data/authors.yml`, `_data/ui-text.yml` — author profiles and UI strings (Minimal Mistakes convention).
- `_includes/` and `_layouts/` — theme partials and page layouts. The author profile sidebar is rendered by `_includes/author-profile.html` from the `author:` block in `_config.yml`.
- `_sass/` — theme stylesheets. `_dark.scss` provides the dark-mode styles introduced in recent commits; `_variables.scss` is the main place to adjust colors/typography.

`_site/` is the generated output. Don't edit it; it's regenerated on every build.

## Generating publication/talk markdown

`markdown_generator/` contains Jupyter notebooks (and equivalent `.py` scripts) that convert TSV files (`publications.tsv`, `talks.tsv`) — or a BibTeX file via `PubsFromBib.ipynb` — into one markdown file per entry under `_publications/` / `_talks/`. Use these when bulk-adding entries; for one-off additions, just author the markdown file directly.

Per global preferences, run Python via `uv` (e.g. `uv run python markdown_generator/publications.py`).

## GitHub Pages constraints

Deployment is the default GitHub Pages build — there is no custom Actions workflow. That means **only the plugins in the `github-pages` gem's allowlist will run in production**. The `plugins:` and `whitelist:` lists in `_config.yml` already reflect this (`jekyll-paginate`, `jekyll-sitemap`, `jekyll-gist`, `jekyll-feed`, `jekyll-redirect-from`, `jemoji`). Adding a non-allowlisted plugin will work locally but silently no-op on production.

The `CNAME` file pins the custom domain; don't remove it.
