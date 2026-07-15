# Make.com Blog Webhook

Endpoint:

```text
POST /api/webhooks/make/blog-post
```

Authentication:

```http
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
```

You can also send the same secret with:

```http
x-llmvisio-webhook-secret: <MAKE_WEBHOOK_SECRET>
```

Example payload:

```json
{
  "externalId": "make-article-001",
  "status": "published",
  "publishedAt": "2026-07-14T10:00:00.000Z",
  "heroImageUrl": "https://example.com/blog/ai-search.jpg",
  "author": {
    "email": "author@example.com",
    "slug": "ana-novak",
    "name": "Ana Novak",
    "title": "AI Visibility Strategist",
    "bio": "Writes about AI visibility and generative search.",
    "avatarUrl": "https://example.com/authors/ana.jpg",
    "websiteUrl": "https://example.com",
    "linkedinUrl": "https://www.linkedin.com/in/ana-novak"
  },
  "category": {
    "slug": "ai-visibility",
    "translations": {
      "en": {
        "name": "AI Visibility",
        "slug": "ai-visibility",
        "description": "Articles about brand visibility in AI answers."
      },
      "sl": {
        "name": "AI vidnost",
        "slug": "ai-vidnost",
        "description": "Clanki o vidnosti znamk v AI odgovorih."
      }
    }
  },
  "translations": {
    "en": {
      "title": "How AI search changes brand discovery",
      "slug": "how-ai-search-changes-brand-discovery",
      "excerpt": "A practical look at citations, mentions and source selection.",
      "contentMarkdown": "## Why it matters\n\nAI assistants summarize markets before buyers click.",
      "seoTitle": "How AI search changes brand discovery",
      "seoDescription": "Learn how AI assistants change brand discovery."
    },
    "sl": {
      "title": "Kako AI iskanje spreminja odkrivanje znamk",
      "slug": "kako-ai-iskanje-spreminja-odkrivanje-znamk",
      "excerpt": "Prakticen pogled na citate, omembe in izbiro virov.",
      "contentMarkdown": "## Zakaj je pomembno\n\nAI asistenti povzamejo trg, preden kupec klikne.",
      "seoTitle": "Kako AI iskanje spreminja odkrivanje znamk",
      "seoDescription": "Spoznajte, kako AI asistenti spreminjajo odkrivanje znamk."
    }
  }
}
```

Statuses:

- `draft`
- `published`
- `scheduled`
- `archived`

Only `published` posts with `publishedAt` in the past are shown on public blog pages.
