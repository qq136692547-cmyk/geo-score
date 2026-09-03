# Blogger SEO & GEO Guide

Optimizing Blogger (Blogspot) blogs for both traditional SEO and Generative Engine Optimization.

---

## Why Blogger Is Different

Blogger has unique constraints that affect GEO implementation:

| Constraint | Impact on GEO |
|------------|---------------|
| No direct `<head>` access per post | Schema must go in post body |
| Template-level variables are limited | OG tags require careful template editing |
| No plugin ecosystem | All GEO work is manual |
| Base64 images possible in posts | First image should be real URL for OG |

---

## Step 1: Template-Level Setup

### Open Graph Tags

Edit your Blogger theme HTML. Find `<head>` and add OG/Twitter tags **inside** the head section:

```html
<b:if cond='data:view.isPost'>
  <meta property='og:title' expr:content='data:view.title'/>
  <meta property='og:description' content='Default description for all posts'/>
  <meta property='og:type' content='article'/>
  <meta property='og:url' expr:content='data:view.url'/>
  <meta name='twitter:card' content='summary_large_image'/>
  <meta name='twitter:title' expr:content='data:view.title'/>
</b:if>
```

**Important:** Use `data:view.title` not `data:blog.postTitle`. The latter resolves empty on post pages in many Blogger templates.

### robots.txt

Blogger has a built-in custom robots.txt field:
- Go to **Settings → Errors and Redirects → Custom robots.txt**
- Enable and paste:

```
User-agent: *
Allow: /
Sitemap: https://your-blog.blogspot.com/atom.xml
```

### Search Description

Go to **Settings → Meta Tags → Enable Search Description** and add a site-wide description (120–160 chars).

---

## Step 2: Per-Post GEO Elements

### FAQPage Schema in Post Body

Since Blogger doesn't allow per-post `<head>` modification, embed JSON-LD in the post body:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Your question here?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Your answer here with specific data."
      }
    }
  ]
}
</script>
```

Place this at the bottom of your post, just before the FAQ section.

### Visual FAQ Section

Add visible FAQ matching the schema:

```html
<section class="faq-section">
  <h2>Frequently Asked Questions</h2>
  
  <details>
    <summary>Your question here?</summary>
    <p>Your answer here.</p>
  </details>
</section>
```

### Author Byline

Since Blogger may not show author on all templates, add manually:

```
*By L.D. Studio*
```

Or insert as HTML in the post body.

### First Image Must Be a Real URL

For OG:image to work:
- First image in the post must be a hosted URL (not base64)
- Use free image hosts like catbox.moe, imgur, or your own domain
- The OG tag `data:blog.postImageUrl` resolves from the first image in the post

---

## Step 3: Settings Checklist

| Setting | Location | Value |
|---------|----------|-------|
| HTTPS Redirect | Settings → Publishing | ON |
| Search Description | Settings → Meta Tags | ON + fill description |
| Custom robots.txt | Settings → Errors | ON + paste robots.txt |
| Custom ads.txt | Settings → Earnings | ON + paste ads.txt |
| Blog Feed | Settings → Site Feed | Allow all |
| Image Lightbox | Settings → Posts | ON |
| WebP Images | Settings → Posts | ON |
| Timezone | Settings → Format | Set to your timezone |
| Language | Settings → Basic | Set appropriately |

---

## Step 4: Monitoring

### Google Search Console

Add your blogspot.com domain (and custom domain if used) to Search Console:
- Go to `https://search.google.com/search-console`
- Add both URL prefix (`https://your-blog.blogspot.com`) and Domain property

### Google Analytics

Add GA4 to your blog:
1. Create a GA4 property
2. Get the Measurement ID (`G-XXXXXXXX`)
3. Paste in Blogger → Settings → Basic → Google Analytics Measurement ID

---

## Blogger-Specific Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| `data:blog.postTitle` empty | OG title missing | Use `data:view.title` |
| `data:blog.metaDescription` empty | OG description missing | Use static text |
| OG block before `<head>` | XML parse error | Ensure OG code is inside `<head>` |
| First image is base64 | OG image missing | Make first image a real URL |
| Base64 image too large | Slow page load | Compress to ~300KB, quality=50 |
| uguu.se images deleted | Broken images | Use base64 embedding or catbox.moe |