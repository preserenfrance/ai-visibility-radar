DO $$
DECLARE
  v_author_id TEXT;
  v_category_id TEXT;
BEGIN
  INSERT INTO "BlogAuthor" ("id", "slug", "name", "title", "bio", "createdAt", "updatedAt")
  VALUES (
    'blog_author_ai_visibility_radar',
    'ai-visibility-radar',
    'AI Visibility Radar',
    'AI visibility strategists',
    'Practical guides on AI visibility, generative search, prompts, citations and brand measurement.',
    NOW(),
    NOW()
  )
  ON CONFLICT ("slug") DO UPDATE SET
    "name" = EXCLUDED."name",
    "title" = EXCLUDED."title",
    "bio" = EXCLUDED."bio",
    "updatedAt" = NOW()
  RETURNING "id" INTO v_author_id;

  INSERT INTO "BlogCategory" ("id", "slug", "createdAt", "updatedAt")
  VALUES ('blog_category_ai_visibility', 'ai-visibility', NOW(), NOW())
  ON CONFLICT ("slug") DO UPDATE SET "updatedAt" = NOW()
  RETURNING "id" INTO v_category_id;

  INSERT INTO "BlogCategoryTranslation" ("id", "categoryId", "locale", "slug", "name", "description", "createdAt", "updatedAt")
  VALUES
    (
      'blog_category_ai_visibility_sl',
      v_category_id,
      'sl',
      'ai-vidnost',
      'AI vidnost',
      'Clanki o AI vidnosti, generativnem iskanju, GEO optimizaciji in merjenju znamk v AI odgovorih.',
      NOW(),
      NOW()
    ),
    (
      'blog_category_ai_visibility_en',
      v_category_id,
      'en',
      'ai-visibility',
      'AI Visibility',
      'Articles about AI visibility, generative search, GEO optimization and brand measurement in AI answers.',
      NOW(),
      NOW()
    )
  ON CONFLICT ("categoryId", "locale") DO UPDATE SET
    "slug" = EXCLUDED."slug",
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "updatedAt" = NOW();
END $$;

CREATE OR REPLACE FUNCTION "_seedSeoBlogPost"(
  p_post_id TEXT,
  p_external_id TEXT,
  p_published_at TIMESTAMP,
  p_sl_slug TEXT,
  p_sl_title TEXT,
  p_sl_excerpt TEXT,
  p_sl_content TEXT,
  p_sl_seo_title TEXT,
  p_sl_seo_description TEXT,
  p_en_slug TEXT,
  p_en_title TEXT,
  p_en_excerpt TEXT,
  p_en_content TEXT,
  p_en_seo_title TEXT,
  p_en_seo_description TEXT
) RETURNS void AS $$
DECLARE
  v_post_id TEXT;
  v_author_id TEXT;
  v_category_id TEXT;
BEGIN
  SELECT "id" INTO v_author_id FROM "BlogAuthor" WHERE "slug" = 'ai-visibility-radar' LIMIT 1;
  SELECT "id" INTO v_category_id FROM "BlogCategory" WHERE "slug" = 'ai-visibility' LIMIT 1;

  INSERT INTO "BlogPost" ("id", "externalId", "status", "publishedAt", "authorId", "categoryId", "createdAt", "updatedAt")
  VALUES (
    p_post_id,
    p_external_id,
    'published'::"BlogPostStatus",
    p_published_at,
    v_author_id,
    v_category_id,
    NOW(),
    NOW()
  )
  ON CONFLICT ("externalId") DO UPDATE SET
    "status" = EXCLUDED."status",
    "publishedAt" = EXCLUDED."publishedAt",
    "authorId" = EXCLUDED."authorId",
    "categoryId" = EXCLUDED."categoryId",
    "updatedAt" = NOW()
  RETURNING "id" INTO v_post_id;

  INSERT INTO "BlogPostTranslation" (
    "id", "postId", "locale", "slug", "title", "excerpt", "contentMarkdown",
    "seoTitle", "seoDescription", "createdAt", "updatedAt"
  )
  VALUES
    (
      v_post_id || '_sl',
      v_post_id,
      'sl',
      p_sl_slug,
      p_sl_title,
      p_sl_excerpt,
      p_sl_content,
      p_sl_seo_title,
      p_sl_seo_description,
      NOW(),
      NOW()
    ),
    (
      v_post_id || '_en',
      v_post_id,
      'en',
      p_en_slug,
      p_en_title,
      p_en_excerpt,
      p_en_content,
      p_en_seo_title,
      p_en_seo_description,
      NOW(),
      NOW()
    )
  ON CONFLICT ("postId", "locale") DO UPDATE SET
    "slug" = EXCLUDED."slug",
    "title" = EXCLUDED."title",
    "excerpt" = EXCLUDED."excerpt",
    "contentMarkdown" = EXCLUDED."contentMarkdown",
    "seoTitle" = EXCLUDED."seoTitle",
    "seoDescription" = EXCLUDED."seoDescription",
    "updatedAt" = NOW();
END;
$$ LANGUAGE plpgsql;

SELECT "_seedSeoBlogPost"(
  'blog_post_ai_visibility_guide_2026',
  'seo-blog-2026-09-01-01',
  '2026-09-01 08:00:00',
  'kaj-je-ai-vidnost',
  'Kaj je AI vidnost in kako jo meriti v ChatGPT, Gemini in AI Overviews',
  'Prakticen vodic za podjetja, ki zelijo razumeti, ali jih AI asistenti omenijo, uvrstijo in citirajo.',
  $sl$## Kaj pomeni AI vidnost

AI vidnost je sposobnost znamke, da se pojavi v odgovorih, ki jih ljudje dobijo od ChatGPT, Gemini, Claude, Perplexity, Google AI Overviews in drugih AI iskalnih izkusenj. Kupec danes ne vpise vec samo kratke kljucne besede. Pogosto vprasa celotno vprasanje: katero orodje naj izberem, kateri ponudnik je najboljsi za moj primer, kaksne so alternative in komu lahko zaupam.

Ce se znamka v takem odgovoru ne pojavi, izgublja del poti do nakupa, tudi ce ima dober klasicen SEO. Ce se pojavi brez konteksta, brez dokazov ali za konkurentom, je signal se bolj pomemben: AI sistem pozna trg, ampak vloge znamke ne razume dovolj dobro.

## Kako se AI vidnost razlikuje od SEO

SEO meri, kako dobro se stran uvrsca v rezultatih iskanja. AI vidnost meri, kako se znamka pojavi v sintetiziranem odgovoru. To pomeni, da so poleg pozicije pomembni tudi ton, tocnost, citirani viri, konkurenti v istem odgovoru in razlogi, zakaj je model znamko izbral ali izpustil.

Google v dokumentaciji za [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) poudarja, da za AI Overviews in AI Mode se vedno veljajo osnovna SEO pravila: indeksiranje, koristna vsebina, notranje povezave, dobra uporabniska izkusnja in tekst, ki ga sistemi lahko razumejo. Razlika je v merjenju. Pri AI odgovorih ni dovolj vedeti, da je stran indeksirana; vedeti moramo, ali je bila dejansko uporabljena kot dokaz ali kontekst.

## Katere metrike spremljati

- Delez vprasanj, kjer je znamka omenjena.
- Povprecna pozicija znamke, kadar model nasteje ponudnike.
- Konkurenti, ki se pojavljajo v istih odgovorih.
- Citirane domene, ki podpirajo odgovor.
- Tocnost opisa znamke, ponudbe, cenovnega razreda in primerov uporabe.
- Sprememba skozi cas po novih vsebinah, PR objavah ali tehnicnih popravkih.

## Zakaj enkratni test ni dovolj

AI odgovori niso staticni. Spreminjajo se glede na model, jezik, drzavo, sveze vire, nacin vprasanja in to, ali ima izkusnja dostop do spletnega iskanja. Zato je treba AI vidnost meriti kot trend, ne kot posnetek zaslona.

Prakticen pristop je, da za vsak brand pripravite stalni nabor nakupnih vprasanj. Vprasanja naj pokrijejo informacijske, primerjalne in nakupne namene. Nato jih redno izvajate cez vec modelov in opazujete, ali se znamka pojavlja pogosteje, visje in z boljsim kontekstom.

## Kako zaceti

Zacnite z desetimi vprasanji, ki bi jih idealna stranka zastavila pred nakupom. Nato preverite:

- ali je znamka omenjena,
- ali so omenjeni konkurenti,
- kateri viri so citirani,
- ali je opis ponudbe pravilen,
- kateri manjkajoci dokazi bi izboljsali odgovor.

Ce potrebujete hiter zacetek, lahko uporabite [brezplacni AI visibility checker](/ai-visibility-checker). Za sistematicno spremljanje pa je smiselno imeti dashboard, ki loceno meri omembe, citate, konkurente in priporocene izboljsave za vsak brand.$sl$,
  'Kaj je AI vidnost? Merjenje ChatGPT in AI Overviews',
  'Kaj je AI vidnost, kako se razlikuje od SEO in katere metrike morate spremljati v ChatGPT, Gemini in Google AI Overviews.',
  'what-is-ai-visibility',
  'What Is AI Visibility and How to Measure It in ChatGPT, Gemini and AI Overviews',
  'A practical guide for teams that want to know whether AI assistants mention, rank and cite their brand.',
  $en$## What AI visibility means

AI visibility is the ability of a brand to appear in answers generated by ChatGPT, Gemini, Claude, Perplexity, Google AI Overviews and other AI search experiences. Buyers no longer use only short keywords. They ask full questions: which tool should I choose, which provider fits my situation, what are the alternatives and who can I trust.

If a brand does not appear in those answers, it loses part of the buying journey even when classic SEO is healthy. If it appears below competitors or with weak context, that is also useful signal: the AI system knows the market, but does not understand the brand well enough.

## How AI visibility differs from SEO

SEO measures how well pages rank in search results. AI visibility measures how a brand appears inside a synthesized answer. Position matters, but so do tone, accuracy, cited sources, competitors in the same answer and the reasons a model includes or omits the brand.

Google's [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) guidance says the fundamentals still matter for AI Overviews and AI Mode: indexing, helpful content, internal links, page experience and text that systems can understand. The measurement layer changes. It is not enough to know that a page can be indexed; you need to know whether it is used as evidence or context.

## Metrics worth tracking

- Share of prompts where the brand is mentioned.
- Average rank when the model lists providers.
- Competitors that appear in the same answer.
- Cited domains that support the answer.
- Accuracy of the brand description, offer, pricing tier and use cases.
- Trend after new content, PR, product updates or technical fixes.

## Why one test is not enough

AI answers are not static. They vary by model, language, country, fresh sources, wording and whether the experience has live web search. Treat AI visibility as a trend, not a screenshot.

A practical setup is to create a stable set of buying questions for each brand. Cover informational, comparison and purchase intent. Run them regularly across models and watch whether the brand appears more often, higher and with better context.

## How to start

Start with ten questions your ideal buyer would ask before purchasing. Then check whether the brand is mentioned, which competitors appear, what sources are cited, whether the offer is described correctly and what missing evidence would improve the answer.

You can begin with the [free AI visibility checker](/ai-visibility-checker). For ongoing work, use a dashboard that separates mentions, citations, competitors and recommended improvements for each brand.$en$,
  'What Is AI Visibility? ChatGPT and AI Overviews Guide',
  'Learn what AI visibility means, how it differs from SEO, and which metrics to track across ChatGPT, Gemini and Google AI Overviews.'
);

SELECT "_seedSeoBlogPost"(
  'blog_post_geo_vs_seo_2026',
  'seo-blog-2026-09-01-02',
  '2026-08-31 08:00:00',
  'geo-vs-seo',
  'GEO vs SEO: kako optimizirati vsebino za generativne iskalnike',
  'GEO ni zamenjava za SEO, ampak razsiritev: vsebina mora biti uporabna za ljudi, iskalnike in AI odgovore.',
  $sl$## GEO ni magicna bliznjica

GEO oziroma generative engine optimization pomeni optimizacijo za AI odgovore. V praksi to ni trik, s katerim se "pretentajo" modeli. Gre za bolj jasno, dokazljivo in strukturirano komunikacijo o tem, komu znamka pomaga, v katerih primerih uporabe je mocna in zakaj ji je vredno zaupati.

Google v vodicu [Optimizing your website for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) opozarja, da so izrazi AEO in GEO koristni kot opisi prakse, vendar je iz perspektive Google Search to se vedno del SEO. To je pomembno: ne gradite locenega, umetnega sistema za AI. Gradite boljso vsebino in boljse dokaze.

## Kaj ostane enako kot pri SEO

Osnovna pravila ostanejo zelo znana:

- stran mora biti indeksabilna,
- vsebina mora biti koristna in napisana za ljudi,
- kljucne strani morajo imeti notranje povezave,
- strukturirani podatki morajo odrazati vidno vsebino,
- stran mora jasno odgovoriti na iskalni namen.

Ce teh osnov ni, GEO nima podlage. AI sistem pogosto uporablja iskalne indekse, javne vire in semantiko strani. Slaba tehnicna SEO higiena zato hitro postane tudi slaba AI vidnost.

## Kaj se pri GEO doda

GEO doda vec pozornosti na odgovore, ki jih lahko model sestavi iz vase vsebine. Dobra GEO stran ne cilja samo na eno kljucno besedo, ampak pokrije sklop povezanih vprasanj:

- komu je res namenjena resitev,
- kdaj ni najboljsa izbira,
- kako se primerja z alternativami,
- katere dokaze ima,
- katere rezultate lahko uporabnik pricakuje,
- kako zaceti.

Tak nacin pisanja pomaga uporabniku in hkrati daje modelu vec tocnih gradnikov za povzetek.

## Primer prakticne razlike

Klasicen SEO clanek ima naslov "Najboljsa orodja za AI marketing". GEO usmerjen clanek gre globlje: "Kako izbrati orodje za merjenje AI vidnosti v B2B podjetju". Drugi naslov ima jasen primer uporabe, ciljno publiko in kriterije odlocanja. To je boljsa stran za cloveka in boljsi vir za AI asistenta.

## Kako meriti GEO uspeh

Ne merite samo pozicije v Googlu. Spremljajte tudi:

- ali vas ChatGPT omeni pri primerjalnih vprasanjih,
- ali Gemini pravilno povzame vaso ponudbo,
- ali AI Overviews prikaze povezave do vasih vsebin,
- ali so citirani viri v skladu z vasim pozicioniranjem,
- ali se delez omemb izboljsa po objavi novih strani.

GEO je najboljsi, ko je povezan z uredniskim koledarjem. Vsak clanek naj popravi konkreten manjkajoci dokaz v AI odgovorih.$sl$,
  'GEO vs SEO: optimizacija za generativne iskalnike',
  'Razlika med GEO in SEO, kaj ostane enako in kako meriti vidnost znamke v AI odgovorih.',
  'geo-vs-seo',
  'GEO vs SEO: How to Optimize Content for Generative Search',
  'GEO is not a replacement for SEO. It is an extension that makes content useful for people, search engines and AI answers.',
  $en$## GEO is not a shortcut

GEO, or generative engine optimization, means optimizing for AI answers. In practice it is not a trick for manipulating models. It is a discipline for making your positioning clearer, more evidence-based and easier to summarize.

Google's guide to [optimizing for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) notes that AEO and GEO are useful industry terms, but from the Google Search perspective this is still SEO. That matters. Do not build an artificial second system for AI. Build better content and stronger evidence.

## What stays the same

The fundamentals are familiar:

- pages must be indexable,
- content must be useful and written for people,
- important pages need internal links,
- structured data should match visible content,
- the page should satisfy search intent.

If these basics are weak, GEO has no foundation. AI systems often rely on search indexes, public sources and page semantics. Poor technical SEO quickly becomes poor AI visibility.

## What GEO adds

GEO adds attention to the answers a model can construct from your content. A strong page does not chase one keyword only. It covers a cluster of related questions: who the product is for, when it is not the best fit, how it compares to alternatives, what evidence supports it, what results users can expect and how to get started.

That structure helps readers and gives AI assistants more accurate building blocks for summaries.

## A practical difference

A classic SEO article might target "best AI marketing tools". A GEO-oriented article goes deeper: "How to choose an AI visibility measurement tool for a B2B company". The second title has a use case, audience and decision criteria. It is better for a human and a better source for an AI answer.

## How to measure GEO success

Do not measure Google rankings only. Track whether ChatGPT mentions you in comparison prompts, whether Gemini summarizes your offer correctly, whether AI Overviews can surface your pages, whether cited sources match your positioning and whether mention share improves after content updates.

GEO works best when it is connected to an editorial calendar. Every article should fix a specific missing piece of evidence in AI answers.$en$,
  'GEO vs SEO: Generative Search Optimization Guide',
  'Understand the difference between GEO and SEO, what still matters, and how to measure brand visibility in AI-generated answers.'
);

SELECT "_seedSeoBlogPost"(
  'blog_post_ai_overviews_seo_2026',
  'seo-blog-2026-09-01-03',
  '2026-08-30 08:00:00',
  'ai-overviews-seo',
  'AI Overviews SEO: kako pripraviti strani, da jih Google lahko uporabi kot vire',
  'Kaj morajo imeti strani, ce zelite vec moznosti za vidnost v Google AI Overviews in AI Mode.',
  $sl$## AI Overviews niso locen iskalnik

Google AI Overviews in AI Mode uporabljata iskalne sisteme, AI tehnike in javne spletne strani za oblikovanje odgovorov. Zato priprava na AI Overviews ni locen projekt od SEO. Je bolj natancna izvedba osnov: jasne strani, uporabni odgovori, tehnicna dostopnost in vsebina, ki jo lahko Google razume.

V Google dokumentaciji [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) je pomembna tocka: za prikaz kot podporna povezava v AI funkcijah mora biti stran indeksirana in upravicena do prikaza s snippetom v Google Search. To pomeni, da `noindex`, pretirano omejeni snippeti ali vsebina, ki je skrita pred crawlerji, neposredno zmanjsajo moznost vidnosti.

## Stran mora odgovoriti na nalogo

AI Overviews se pogosto pojavijo pri kompleksnejsih vprasanjih. Zato strani, ki samo ponovijo kljucno besedo, niso dovolj. Boljse delujejo strani, ki pokrijejo celotno nalogo uporabnika:

- definicija problema,
- kriteriji odlocanja,
- primeri,
- napake,
- podatki ali izkusnje,
- naslednji korak.

Ce pisete o AI vidnosti, ne zadosca stavek "merimo AI visibility". Uporabnik potrebuje razlago, katere modele merite, kako pogosto, katere metrike spremljate in kako naj interpretira spremembe.

## Tehnicni elementi, ki jih ne preskocite

Preden razmisljate o posebnih AI taktikah, uredite osnovno:

- stran naj vraca stabilen status 200,
- pomembna vsebina naj bo v HTML tekstu,
- naslov in meta opis naj obljubljata tocno to, kar stran dostavi,
- notranje povezave naj vodijo do sorodnih vodicev,
- schema naj se ujema z vidno vsebino,
- strani naj bodo v sitemapu.

To niso spektakularni popravki, ampak pri AI iskanju so se pomembnejsi, ker modeli potrebujejo zanesljiv, razumljiv vhod.

## Kako pisati za citiranje

Stran, ki jo AI lahko uporabi kot vir, naj vsebuje konkretne stavke, ne samo marketinske trditve. Namesto "smo najbolj napredni" napisite, kaj izdelek meri, kako se izracuna rezultat, katere vire uporablja in kaj je omejitev metode.

Dobri odstavki za AI Overviews pogosto delujejo kot majhni odgovori. Imajo jasen predmet, dokaz in kontekst. To je koristno tudi za navadne bralce, zato ni kompromis med SEO in UX.

## Merjenje po objavi

Po objavi strani spremljajte indeksiranje, klike iz Search Console in AI visibility teste. Ce AI odgovor se vedno citira konkurente, primerjajte, kateri dokazi so pri njih mocnejsi: definicije, primerjalne strani, case studies, podatki, avtoriteta domene ali jasnejsa struktura.

Cilj ni samo vec strani. Cilj je manj dvoumnosti za uporabnika in za model.$sl$,
  'AI Overviews SEO: kako pripraviti strani za AI iskanje',
  'Prakticni koraki za vec moznosti vidnosti v Google AI Overviews in AI Mode: indeksiranje, vsebina, struktura in merjenje.',
  'ai-overviews-seo',
  'AI Overviews SEO: How to Prepare Pages for Google AI Features',
  'What pages need if you want a better chance of visibility in Google AI Overviews and AI Mode.',
  $en$## AI Overviews are not a separate search engine

Google AI Overviews and AI Mode use search systems, AI techniques and public web pages to generate answers. Preparing for AI Overviews is therefore not separate from SEO. It is a more precise execution of the basics: clear pages, useful answers, technical accessibility and content Google can understand.

Google's [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) guidance makes one point especially practical: to appear as a supporting link in AI features, a page must be indexed and eligible to show a snippet in Google Search. `noindex`, strict snippet controls or content hidden from crawlers reduce the opportunity.

## The page must complete the user's task

AI Overviews often appear for more complex questions. Pages that simply repeat a keyword are weak sources. Better pages cover the full user task: the problem, decision criteria, examples, common mistakes, data or experience and the next step.

If you write about AI visibility, it is not enough to say "we measure AI visibility". The reader needs to know which models you measure, how often, which metrics matter and how to interpret movement.

## Technical basics not to skip

Before chasing special AI tactics, check the basics:

- the page returns a stable 200 status,
- important content is available as HTML text,
- title and meta description match the page,
- internal links connect related guides,
- structured data matches visible content,
- the page is included in the sitemap.

These are not glamorous tasks, but they matter because AI systems need reliable and understandable inputs.

## How to write for citation

A page that can be cited by AI should contain specific statements, not only marketing claims. Instead of "we are the most advanced", explain what the product measures, how the score is calculated, which sources it uses and where the method has limits.

Good AI Overview source paragraphs often work as small answers. They include a clear subject, evidence and context. That helps readers too, so this is not a tradeoff between SEO and UX.

## Measuring after publication

After publishing, monitor indexing, Search Console clicks and AI visibility tests. If AI answers still cite competitors, compare their evidence: definitions, comparison pages, case studies, data, domain authority or clearer structure.

The goal is not more pages. The goal is less ambiguity for both the reader and the model.$en$,
  'AI Overviews SEO: Prepare Pages for AI Search',
  'Practical steps for visibility in Google AI Overviews and AI Mode: indexing, content structure, snippets and measurement.'
);

SELECT "_seedSeoBlogPost"(
  'blog_post_chatgpt_seo_ecommerce_2026',
  'seo-blog-2026-09-01-04',
  '2026-08-29 08:00:00',
  'chatgpt-seo-ecommerce',
  'ChatGPT SEO za e-commerce: kako postati bolj viden v produktnih priporocilih',
  'Kako naj spletne trgovine pripravijo produktne podatke, opise, ocene in primerjave za AI nakupovalne asistente.',
  $sl$## Kupci raziskujejo v pogovoru

Pri e-commerce SEO ni vec dovolj, da je produktna stran optimizirana za eno iskalno frazo. Kupci v AI asistentih opisujejo potrebe: "najdi tihi sesalnik za majhno stanovanje", "primerjaj te tri izdelke", "kaj je najboljse za obcutljivo kozo". Odgovor pogosto ze vsebuje shortlist, kriterije in razlago.

OpenAI v clanku [Powering Product Discovery in ChatGPT](https://openai.com/index/powering-product-discovery-in-chatgpt/) opisuje smer, kjer uporabniki izdelke odkrivajo, primerjajo in zozujejo izbiro kar v ChatGPT. To pomeni, da mora trgovec razmisljati o tem, kako so produktni podatki razumljivi za AI sistem, ne samo za klasicen SERP.

## Kaj ChatGPT potrebuje od trgovine

OpenAI Help Center pri [Shopping with ChatGPT Search](https://help.openai.com/en/articles/11128490-improved-shopping-results-from-chatgpt-search) navaja, da lahko ChatGPT pri produktnih rezultatih uposteva strukturirane metapodatke, opise, ocene, razpolozljivost, ceno in druge javne informacije. Za trgovca je to zelo prakticno: slab, kratek ali nejasen produktni opis je slab vhod.

Osnovni elementi:

- jasen naziv izdelka,
- kategorija in namen uporabe,
- kljucne specifikacije,
- cena in razpolozljivost,
- slike,
- ocene in povzetki uporabniskih izkusenj,
- podatki o dostavi in vracilih,
- primerjave z alternativami.

## Produktni opis naj odgovori na odlocanje

AI asistent ne isce samo "kaj je to". Pomaga pri odlocitvi. Zato naj opis pove, za koga je izdelek primeren, kdaj ni najboljsa izbira, katere lastnosti so pomembne in kako se razlikuje od podobnih izdelkov.

Primer: namesto "lahka jakna za prosti cas" napisite, za kaksne temperature je primerna, ali je vodoodbojna, kako se prilega, kaksna je sestava materiala, kako jo kombinirati in katera alternativa je boljsa za dez.

## Kategorijske strani so se pomembnejse

AI sistemi pogosto povzemajo kategorije, ne samo posamezne izdelke. Kategorijska stran naj zato vsebuje uredniski uvod, kriterije izbire, povezave do podkategorij in odgovore na pogosta vprasanja. To ni samo SEO tekst na dnu strani. To je vodic, ki uporabniku pomaga izbrati.

## Kako meriti vidnost trgovine v ChatGPT

Pripravite nakupna vprasanja po kategorijah:

- najboljsi izdelek za dolocen problem,
- primerjava dveh ali treh izdelkov,
- izbira po ceni,
- izbira po omejitvi,
- darilo za doloceno osebo,
- alternativa znani znamki.

Nato merite, ali se pojavljajo vasi izdelki, vasi konkurenti, vasi viri in pravilni atributi. Ce AI priporoca konkurenta, ker ima boljsi dokaz o ocenah, primerjavah ali specifikacijah, imate zelo konkreten nacrt za izboljsavo.$sl$,
  'ChatGPT SEO za e-commerce in produktna priporocila',
  'Kako optimizirati spletno trgovino za ChatGPT shopping, produktne podatke in AI nakupovalne asistente.',
  'chatgpt-seo-for-ecommerce',
  'ChatGPT SEO for Ecommerce: How to Appear in Product Recommendations',
  'How online stores should prepare product data, descriptions, reviews and comparison content for AI shopping assistants.',
  $en$## Buyers research through conversation

Ecommerce SEO is no longer only about optimizing a product page for one search phrase. Buyers describe needs inside AI assistants: "find a quiet vacuum for a small apartment", "compare these three products", "what is best for sensitive skin". The answer may already include a shortlist, criteria and reasoning.

OpenAI's [Powering Product Discovery in ChatGPT](https://openai.com/index/powering-product-discovery-in-chatgpt/) describes a direction where users discover, compare and narrow products inside ChatGPT. Merchants therefore need product data that is understandable to AI systems, not only to classic search results.

## What ChatGPT needs from a store

OpenAI's [Shopping with ChatGPT Search](https://help.openai.com/en/articles/11128490-improved-shopping-results-from-chatgpt-search) explains that product results can use structured metadata, descriptions, reviews, availability, price and other public information. For merchants, the implication is practical: thin or unclear product content is weak input.

Core elements include clear product names, category and use case, key specifications, price and availability, images, reviews, delivery and returns information and comparisons with alternatives.

## Product descriptions should support decisions

An AI assistant is not only asking "what is this". It is helping someone decide. A strong description explains who the product is for, when it is not the best fit, which attributes matter and how it differs from similar options.

Instead of "light jacket for leisure", explain the temperature range, whether it is water-resistant, how it fits, what material it uses, how to style it and which alternative is better for rain.

## Category pages matter more

AI systems often summarize categories, not only products. A category page should include an editorial introduction, selection criteria, links to subcategories and answers to common questions. This should not be filler text at the bottom of a page. It should help the user choose.

## How to measure store visibility in ChatGPT

Create buying prompts by category: best product for a problem, comparison between products, choice by budget, choice by constraint, gift for a specific person and alternative to a known brand.

Then measure whether your products appear, which competitors show up, which sources are cited and whether product attributes are correct. If AI recommends a competitor because their reviews, comparisons or specifications are clearer, you have a concrete improvement plan.$en$,
  'ChatGPT SEO for Ecommerce Product Recommendations',
  'Optimize ecommerce product pages, structured product data and category content for ChatGPT shopping and AI product discovery.'
);

SELECT "_seedSeoBlogPost"(
  'blog_post_ai_visibility_prompts_2026',
  'seo-blog-2026-09-01-05',
  '2026-08-28 08:00:00',
  'prompt-vprasanja-za-ai-vidnost',
  'Kako izbrati prompt vprasanja za merjenje AI vidnosti',
  'Dober AI visibility test se zacne s pravimi vprasanji: informacijski, primerjalni in nakupni prompti.',
  $sl$## Prompti so nova raziskava iskalnega namena

Pri klasicnem SEO zacnemo s kljucnimi besedami. Pri AI vidnosti zacnemo s prompti: celimi vprasanji, ki jih kupec zastavi, ko raziskuje problem, primerja ponudnike ali pripravlja nakup. Slab nabor promptov vodi v slabe zakljucke. Ce testirate samo "ime kategorije", boste spregledali vprasanja, kjer se dejansko oblikuje izbira.

## Tri vrste promptov

Za vsak brand pripravite vsaj tri skupine:

- Informacijski prompti: uporabnik razume problem in isce razlago.
- Primerjalni prompti: uporabnik primerja pristope, znamke ali kategorije.
- Nakupni prompti: uporabnik isce najboljso izbiro za svoj primer.

Primer za orodje za AI visibility:

- "Kaj je AI visibility in zakaj je pomembna za B2B marketing?"
- "Primerjaj orodja za merjenje vidnosti znamke v ChatGPT."
- "Katero orodje naj uporabi slovensko B2B podjetje za spremljanje AI odgovorov?"

## Prompt naj vsebuje kontekst

AI asistenti se odzivajo na kontekst. Zato vprasanje ne sme biti prevec abstraktno. Dodajte tip podjetja, trg, omejitev, namen ali kriterij.

Slabo: "najboljsi CRM".

Boljse: "kateri CRM je primeren za majhno B2B prodajno ekipo, ki potrebuje avtomatizacijo follow-up emailov in jasen pipeline?"

Tak prompt sprozi boljsi odgovor in bolj realno sliko, ali se znamka pojavi pri pravem nakupnem scenariju.

## Ne testirajte samo svojega imena

Brand prompti so koristni za preverjanje tocnosti, niso pa dovolj za rast. Ce vprasate "kaj je Acme", boste merili prepoznavnost znamke. Ce vprasate "katero orodje pomaga pri X", boste merili trzni polozaj.

Najboljsi nabor promptov vkljucuje:

- probleme, ki jih resujete,
- alternative, s katerimi vas kupci primerjajo,
- industrijske omejitve,
- geografski trg,
- odlocitvene kriterije,
- primere uporabe.

## Kako pogosto osveziti nabor

Osnovni nabor naj ostane stabilen, da lahko merite trend. Dodajajte pa nove promte, ko se spremeni produkt, trg ali konkurenca. Dobra praksa je mesecni pregled: katere nove fraze prihajajo iz prodaje, Search Console, podpore, demo klicev in AI odgovorov.

## Kaj naredi dober prompt uporaben za SEO

Vsak prompt je lahko tudi ideja za clanek, landing page ali FAQ. Ce AI odgovori slabo, je to znak, da na spletu manjka jasen vir. Namesto da samo lovite omembe, iz promptov zgradite uredniski koledar.$sl$,
  'Prompt vprasanja za AI vidnost: kako jih izbrati',
  'Kako pripraviti prompt vprasanja za merjenje AI vidnosti, ChatGPT omemb, konkurentov in nakupnega namena.',
  'ai-visibility-prompts',
  'How to Choose Prompts for Measuring AI Visibility',
  'A strong AI visibility test starts with the right questions: informational, comparison and buying prompts.',
  $en$## Prompts are the new search intent research

Classic SEO starts with keywords. AI visibility starts with prompts: full questions a buyer asks while researching a problem, comparing providers or preparing to purchase. A weak prompt set leads to weak conclusions. If you test only category names, you miss the questions where choices are actually shaped.

## Three prompt types

For each brand, build at least three groups:

- Informational prompts: the user wants to understand the problem.
- Comparison prompts: the user compares approaches, brands or categories.
- Buying prompts: the user wants the best choice for a specific situation.

For an AI visibility tool, examples include: "What is AI visibility and why does it matter for B2B marketing?", "Compare tools for measuring brand visibility in ChatGPT", and "Which tool should a European B2B company use to monitor AI answers?"

## Add context to the prompt

AI assistants respond to context. A question should not be too abstract. Add the company type, market, constraint, intent or decision criteria.

Weak: "best CRM".

Better: "which CRM fits a small B2B sales team that needs automated follow-up emails and a clear pipeline?"

That prompt produces a better answer and a more realistic view of whether a brand appears in the right buying scenario.

## Do not test only your brand name

Brand prompts help with accuracy, but they are not enough for growth. If you ask "what is Acme", you measure brand recognition. If you ask "which tool helps with X", you measure market position.

A strong prompt set includes the problems you solve, alternatives buyers compare, industry constraints, geography, decision criteria and concrete use cases.

## How often to refresh the set

Keep the core set stable so you can measure trend. Add new prompts when the product, market or competitive landscape changes. A monthly review works well: collect phrases from sales calls, Search Console, support, demos and AI answers.

## How prompts become SEO assets

Every prompt can become an article, landing page or FAQ. If AI answers poorly, that is evidence that the web lacks a clear source. Instead of chasing mentions only, turn prompts into an editorial calendar.$en$,
  'AI Visibility Prompts: How to Choose Test Questions',
  'Create prompt sets for AI visibility measurement, ChatGPT mentions, competitor tracking and buying intent.'
);

SELECT "_seedSeoBlogPost"(
  'blog_post_ai_citations_sources_2026',
  'seo-blog-2026-09-01-06',
  '2026-08-27 08:00:00',
  'ai-citati-in-viri',
  'AI citati in viri: kako zgraditi strani, ki jim modeli zaupajo',
  'Vidnost v AI odgovorih je mocnejsa, ko modeli najdejo jasne, preverljive in citabilne vire o vasi znamki.',
  $sl$## Citati so dokaz, ne okrasek

Ko AI odgovor vkljuci povezave, citati uporabniku povedo, od kod prihaja podpora za trditev. Za marketing je to izjemno pomembno. Omenjenost brez vira je dober signal, omenjenost z relevantnim virom pa je mocnejsi signal zaupanja.

Google pri AI funkcijah poudarja, da sistemi prikazujejo relevantne povezave, ki uporabniku pomagajo raziskati temo naprej. OpenAI pri shopping rezultatih omenja uporabo strukturiranih metapodatkov, opisov, ocen in drugih javnih informacij. Skupni imenovalec je jasen: modeli potrebujejo zanesljive vire.

## Kaj naredi stran citabilno

Citabilna stran ima konkretno informacijo, jasen kontekst in dovolj avtoritete. To ni nujno akademski clanek. Lahko je dobra produktna stran, primerjalna stran, dokumentacija, cenik, case study ali raziskava.

Najbolj uporabni elementi:

- tocna definicija kategorije,
- jasen opis ponudbe,
- kriteriji izbire,
- podatki ali metodologija,
- primeri uporabe,
- FAQ z realnimi vprasanji,
- avtor ali organizacija, ki ima razlog za strokovnost.

## Izogibajte se praznim superlativom

AI modeli tezko uporabijo trditve, kot so "najboljsi", "vodilni" ali "najbolj inovativen", ce ni dokazov. Bolj uporabno je napisati, v cem ste mocni in za koga.

Slabo: "Smo vodilna platforma za AI marketing."

Boljse: "Platforma meri, kako pogosto se brand pojavi v odgovorih ChatGPT, Gemini in Claude, katere domene so citirane in kateri konkurenti so omenjeni v istem odgovoru."

Drugi stavek je citabilen, ker vsebuje predmet, metodo in kontekst.

## Viri zunaj vase domene

Lastna stran ni edini vir. AI sistemi lahko upostevajo tudi partnerske strani, medijske objave, imenike, recenzije, GitHub, dokumentacijo, primerjalne clanke in skupnosti. Zato naj bodo osnovni podatki o znamki usklajeni povsod: ime, opis, kategorija, primeri uporabe, cene, drzava, jezik in ciljni segment.

## Kako meriti kakovost virov

Pri vsakem AI visibility testu shranite citirane domene. Nato jih razvrstite:

- lastni viri,
- konkurencni viri,
- neodvisni viri,
- nizkokakovostni ali zastareli viri,
- viri, ki opisujejo trg, ne znamke.

Ce modeli citirajo konkurencne strani pri vprasanjih, kjer bi moral biti vas brand mocen, ne potrebujete samo vec vsebine. Potrebujete boljsi dokaz na strani, ki jo je mogoce najti, razumeti in citirati.$sl$,
  'AI citati in viri: kako zgraditi citabilno vsebino',
  'Kako ustvariti strani, vire in dokaze, ki jih AI modeli lazje uporabijo pri odgovorih o vasi znamki.',
  'ai-citations-and-sources',
  'AI Citations and Sources: How to Build Pages Models Trust',
  'AI visibility is stronger when models can find clear, verifiable and citable sources about your brand.',
  $en$## Citations are evidence

When an AI answer includes links, citations tell the user where the claim is supported. For marketing, this matters. A mention without a source is useful signal. A mention with a relevant source is stronger evidence of trust.

Google explains that AI search features surface links that help users explore further. OpenAI's shopping guidance mentions structured metadata, descriptions, reviews and other public information. The shared lesson is simple: models need reliable sources.

## What makes a page citable

A citable page contains specific information, clear context and enough authority. It does not have to be an academic paper. It can be a product page, comparison page, documentation, pricing page, case study or research report.

Useful elements include a precise category definition, a clear offer description, selection criteria, data or methodology, use cases, FAQ content and an author or organization with a reason to be trusted.

## Avoid empty superlatives

AI models cannot do much with claims like "best", "leading" or "most innovative" when there is no evidence. It is better to explain where you are strong and for whom.

Weak: "We are the leading AI marketing platform."

Better: "The platform measures how often a brand appears in ChatGPT, Gemini and Claude answers, which domains are cited and which competitors are mentioned in the same answer."

The second sentence is citable because it has a subject, method and context.

## Sources outside your domain

Your website is not the only source. AI systems may use partner pages, media coverage, directories, reviews, GitHub, documentation, comparisons and communities. Keep basic brand facts consistent everywhere: name, description, category, use cases, pricing, country, language and target segment.

## How to measure source quality

In every AI visibility test, store the cited domains. Then classify them as owned sources, competitor sources, independent sources, low-quality or outdated sources, and market-level sources that describe the category but not your brand.

If models cite competitor pages for questions where your brand should be strong, you do not need only more content. You need better evidence on a page that can be found, understood and cited.$en$,
  'AI Citations and Sources: Build Citable Content',
  'Learn how to create pages, sources and evidence that AI models can use when answering questions about your brand.'
);

SELECT "_seedSeoBlogPost"(
  'blog_post_ai_competitor_analysis_2026',
  'seo-blog-2026-09-01-07',
  '2026-08-26 08:00:00',
  'analiza-konkurentov-v-ai-odgovorih',
  'Analiza konkurentov v AI odgovorih: kaj meriti in kako ukrepati',
  'AI odgovori pogosto naredijo shortlist ponudnikov. Zato morate meriti, kdo se pojavi z vami, pred vami ali namesto vas.',
  $sl$## AI asistenti oblikujejo shortlist

Pri mnogih nakupnih vprasanjih AI odgovor ne navede vseh moznosti. Naredi shortlist. V njem so lahko tri orodja, pet ponudnikov ali nekaj kategorij resitev. To je trenutek, kjer se konkurencna analiza spremeni: ne zanima vas samo, kdo rangira v Googlu, ampak kdo je v AI odgovoru predstavljen kot smiselna izbira.

## Katere konkurente spremljati

Ne zacnite samo s seznamom konkurentov iz prodaje. AI asistenti lahko ob vas postavijo tudi alternative, ki jih sami ne bi imenovali konkurenti: agencije, odprtokodne resitve, velike platforme, imenike, svetovalce ali "naredi sam" pristop.

Spremljajte tri skupine:

- znane neposredne konkurente,
- alternative, ki jih model predlaga,
- domene, ki jih model citira kot avtoriteto v kategoriji.

## Metrike, ki povedo vec kot omemba

Sama omemba ni dovolj. Merite:

- ali je konkurent omenjen pred vami,
- ali je predstavljen z mocnejsim razlogom,
- ali ima bolj tocne citate,
- ali je povezan z vec primeri uporabe,
- ali model vas brand opisuje kot ozek ali zastarel,
- ali se konkurencni viri pojavljajo v odgovorih o vasih temah.

To hitro pokaze, ali je problem v prepoznavnosti, pozicioniranju, dokazih ali vsebinski vrzeli.

## Kako ukrepati po ugotovitvah

Ce se konkurent pojavlja zaradi boljse primerjalne vsebine, ustvarite stran, ki jasno razlozi kriterije izbire. Ce se pojavlja zaradi case studyjev, objavite konkreten primer uporabe. Ce se pojavlja zaradi ocen, izboljsajte zbiranje in prikaz uporabniskih dokazov. Ce model napacno razume vas produkt, popravite osnovne opise na strani, v dokumentaciji in javnih profilih.

## Primer analize

Recimo, da vprasanje "katero orodje meri vidnost znamke v ChatGPT" vrne tri konkurente, vas pa ne. Preglejte citirane vire. Morda konkurenti uporabljajo jasnejso terminologijo, imajo primerjalne clanke ali pa jih omenjajo neodvisni imeniki. Nato ustvarite vsebino, ki zapolni tocno to vrzel.

## Zakaj trend zmaga nad enkratno primerjavo

AI odgovori se spreminjajo. Zato konkurencno analizo izvajajte redno in vedno z istim naborom promptov. Tako boste videli, ali se po novi vsebini izboljsuje delez omemb, pozicija in kakovost opisa.

Najboljsa AI konkurencna analiza ne konca pri porocilu. Konca pri seznamu vsebinskih, tehnicnih in reputacijskih izboljsav.$sl$,
  'Analiza konkurentov v AI odgovorih: metrike in ukrepi',
  'Kako spremljati konkurente v ChatGPT, Gemini in AI Overviews ter iz AI odgovorov narediti nacrt izboljsav.',
  'ai-competitor-analysis',
  'AI Competitor Analysis: What to Measure in AI Answers',
  'AI answers often create a shortlist of providers. Measure who appears with you, above you or instead of you.',
  $en$## AI assistants create the shortlist

For many buying questions, an AI answer does not list every option. It creates a shortlist: three tools, five providers or a few solution categories. Competitive analysis changes here. You need to know not only who ranks in Google, but who is presented by AI as a reasonable choice.

## Which competitors to track

Do not start only with the sales team's competitor list. AI assistants may place you next to alternatives you would not normally call competitors: agencies, open-source tools, large platforms, directories, consultants or do-it-yourself approaches.

Track three groups: known direct competitors, alternatives suggested by the model and domains cited as authorities in the category.

## Metrics beyond mentions

A mention alone is not enough. Measure whether the competitor appears before you, whether it has a stronger reason, whether citations are more accurate, whether it is connected to more use cases, whether your brand is described too narrowly and whether competitor sources appear in answers about your topics.

This shows whether the issue is awareness, positioning, evidence or a content gap.

## How to act on findings

If a competitor appears because it has better comparison content, create a page that explains selection criteria. If it appears because of case studies, publish a concrete use case. If reviews matter, improve how you collect and display customer evidence. If the model misunderstands your product, fix the core descriptions on your site, documentation and public profiles.

## Example

Suppose the prompt "which tool measures brand visibility in ChatGPT" returns three competitors and not you. Review the cited sources. Competitors may use clearer terminology, have comparison pages or appear in independent directories. Create content that fills that exact gap.

## Trend matters more than a single check

AI answers change. Run competitor analysis regularly with a stable prompt set. Watch whether new content improves mention share, position and description quality.

The best AI competitor analysis does not end with a report. It ends with a list of content, technical and reputation improvements.$en$,
  'AI Competitor Analysis for ChatGPT and AI Search',
  'Track competitors in ChatGPT, Gemini and AI Overviews and turn AI answer gaps into content and positioning improvements.'
);

SELECT "_seedSeoBlogPost"(
  'blog_post_content_for_ai_assistants_2026',
  'seo-blog-2026-09-01-08',
  '2026-08-25 08:00:00',
  'vsebina-za-ai-asistente',
  'Kako napisati vsebino, ki jo AI asistenti razumejo in povzamejo',
  'AI asistenti bolje uporabijo vsebino, ki je konkretna, strukturirana, dokazana in napisana za resnicne uporabniske naloge.',
  $sl$## AI ne potrebuje vec besedila, ampak vec jasnosti

Veliko podjetij se na AI iskanje odzove z idejo, da morajo objaviti vec clankov. Kolicina sama po sebi ni resitev. Google v vodicu za generativne AI funkcije poudarja koristno, zanesljivo in nekomoditetno vsebino. To pomeni, da mora stran prinesti nekaj, kar ni samo prepis splosnega znanja.

## Zacnite z uporabnisko nalogo

Pred pisanjem si zastavite vprasanje: kaj zeli uporabnik po branju narediti bolje? Izbrati orodje, razumeti tveganje, primerjati moznosti, pripraviti interni business case, nastaviti merjenje?

Clanek, ki ima jasno nalogo, je lazje strukturirati in lazje povzeti. Naslov, uvod, podnaslovi in zakljucek delujejo kot zemljevid. AI sistem iz take strani lazje razbere, kateri deli so definicije, kateri kriteriji in kateri priporocila.

## Pisite v odgovorih, ne v sloganih

AI asistenti povzemajo informacije. Zato mora stran vsebovati stavke, ki samostojno odgovorijo na pomembna vprasanja. Slogani imajo vlogo, vendar ne smejo nadomestiti razlage.

Namesto "revolucioniramo analitiko" napisite:

- katero metriko merite,
- od kod prihajajo podatki,
- kako pogosto se osvezujejo,
- katero odlocitev metrika podpira,
- kaj so omejitve.

## Uporabite strukturo, ki podpira razumevanje

Dobro delujejo:

- kratki uvodi po sekcijah,
- jasni H2 in H3 naslovi,
- seznami kriterijev,
- primeri pred in potem,
- FAQ sekcije,
- notranje povezave do globljih razlag,
- avtorski ali metodoloski kontekst.

To ni "pisanje za robote". To je dobro urednistvo.

## Dodajte lastne izkusnje

Ce vsi povzamejo iste definicije, model nima razloga, da izbere vas vir. Dodajte podatke iz prakse: kaj vidite pri strankah, katere napake se ponavljajo, kateri prompti dajejo najbolj uporabne uvide, kako se odzovejo razlicni modeli.

Tudi majhna izkusnja je lahko dragocena, ce je konkretna. Primer: "pri B2B SaaS brandih najpogosteje manjka primerjalna stran, ki razlozi alternativo med agencijo, interno ekipo in orodjem." To je bolj uporabno kot splosen nasvet "pisite kakovostno vsebino".

## Zakljucek naj vodi v naslednji korak

AI traffic je vreden samo, ce uporabnik ve, kaj narediti naprej. Na koncu clanka dodajte povezavo do relevantnega orodja, checklist, template ali naslednjega vodica. Za AI Visibility Radar je to lahko [brezplacni pregled vidnosti](/ai-visibility-checker) ali vodic o izbiri promptov.$sl$,
  'Kako pisati vsebino za AI asistente in AI iskanje',
  'Prakticni vodic za vsebino, ki jo ChatGPT, Gemini in AI Overviews lazje razumejo, povzamejo in citirajo.',
  'content-for-ai-assistants',
  'How to Write Content AI Assistants Can Understand and Summarize',
  'AI assistants use content better when it is specific, structured, evidenced and written for real user tasks.',
  $en$## AI does not need more text. It needs more clarity.

Many companies respond to AI search by publishing more articles. Quantity alone is not the solution. Google's generative AI guidance emphasizes helpful, reliable and non-commodity content. A page should add something beyond a rewrite of common knowledge.

## Start with the user's task

Before writing, ask what the reader should be able to do better after the page: choose a tool, understand a risk, compare options, prepare an internal business case or set up measurement.

A page with a clear task is easier to structure and easier to summarize. The title, introduction, headings and conclusion become a map. AI systems can more easily identify definitions, criteria and recommendations.

## Write answers, not slogans

AI assistants summarize information. A page should contain sentences that answer important questions on their own. Slogans have a place, but they cannot replace explanation.

Instead of "we revolutionize analytics", explain which metric you measure, where data comes from, how often it updates, which decision it supports and what the limitations are.

## Use structure that supports understanding

Strong pages use short section introductions, clear H2 and H3 headings, lists of criteria, before-and-after examples, FAQ sections, internal links to deeper explanations and author or methodology context.

This is not "writing for robots". It is good editorial work.

## Add first-hand experience

If everyone repeats the same definitions, a model has little reason to choose your source. Add evidence from practice: what you see with customers, which mistakes repeat, which prompts produce useful insight and how different models respond.

Even a small observation is valuable when it is concrete. For example: "B2B SaaS brands often lack a comparison page explaining the tradeoff between an agency, an internal team and a tool." That is more useful than "write quality content".

## End with a next step

AI traffic matters only when the reader knows what to do next. Add a relevant tool, checklist, template or next guide. For AI Visibility Radar, that might be a [free visibility check](/ai-visibility-checker) or a guide to choosing prompts.$en$,
  'How to Write Content for AI Assistants and AI Search',
  'A practical guide to content that ChatGPT, Gemini and AI Overviews can understand, summarize and cite.'
);

SELECT "_seedSeoBlogPost"(
  'blog_post_llm_visibility_dashboard_2026',
  'seo-blog-2026-09-01-09',
  '2026-08-24 08:00:00',
  'llm-visibility-dashboard',
  'LLM visibility dashboard: metrike za marketing in vodstvo',
  'Katere metrike naj vsebuje dashboard za AI vidnost, da marketing in vodstvo vidita napredek, tveganja in naslednje ukrepe.',
  $sl$## Dashboard mora povedati, kaj se spreminja

AI visibility porocilo hitro postane zbirka zanimivih odgovorov. Dashboard mora narediti nekaj bolj uporabnega: pokazati, kaj se spreminja, zakaj se spreminja in kaj naj ekipa naredi naprej.

Najslabsi dashboard prikaze samo zadnji odgovor ChatGPT. Najboljsi prikaze trend cez promte, modele, konkurente, citate in priporocila.

## Osnovne metrike

Za vsak brand spremljajte:

- mention rate: pri koliko promptih je znamka omenjena,
- average rank: povprecna pozicija v shortlistih,
- share of voice: delez omemb glede na konkurente,
- citation count: koliko virov podpira odgovore,
- owned citation share: koliko citatov vodi na vase domene,
- accuracy score: ali je opis znamke pravilen,
- sentiment ali recommendation strength: kako mocno model priporoca znamko.

Te metrike niso popolne, vendar ustvarijo skupen jezik med marketingom, SEO ekipo, produktom in vodstvom.

## Segmentacija po modelih

Ne zdruzite vsega v eno stevilko. ChatGPT, Gemini, Claude in Google AI Overviews imajo razlicne vire, nacin odgovarjanja in obcutljivost na svezo vsebino. Dashboard naj zato prikaze rezultate po modelu in po tipu prompta.

Primer: brand je lahko dober v informativnih promptih, slab pa pri nakupnih primerjavah. Povprecje tega ne pokaze dovolj jasno.

## Konkurenti in viri

Vodstvo pogosto najhitreje razume problem, ko vidi, kateri konkurent se pojavlja namesto vas. Zato naj dashboard vsebuje:

- top konkurente po omembah,
- domene, ki jih modeli najpogosteje citirajo,
- prompti, kjer vas ni,
- prompti, kjer je opis napacen,
- priporocene vsebinske izboljsave.

To spremeni AI visibility iz abstraktnega trenda v konkreten backlog.

## Povezava z uredniskim koledarjem

Dashboard naj ne stoji loceno od dela ekipe. Ko odkrijete, da AI asistenti ne razumejo vase kategorije, ustvarite razlagalni clanek. Ko ne citirajo vase strani, izboljsajte vir. Ko konkurent zmaga zaradi primerjalne vsebine, objavite primerjavo ali vodic za izbiro.

Vsaka metrika mora imeti mogoc ukrep.

## Kako pogosto porocati

Za operativno ekipo je smiseln tedenski pregled. Za vodstvo je dovolj mesecni povzetek: napredek omemb, najvecja tveganja, top konkurenti, nove priloznosti in izvedeni ukrepi.

Dober LLM visibility dashboard ne poskusa dokazati, da AI "deluje". Pokaze, kje kupci dobijo odgovor brez vas in kako to popraviti.$sl$,
  'LLM visibility dashboard: metrike za AI vidnost',
  'Katere metrike meriti v AI visibility dashboardu: omembe, ranking, share of voice, citati, konkurenti in tocnost odgovorov.',
  'llm-visibility-dashboard',
  'LLM Visibility Dashboard: Metrics for Marketing and Leadership',
  'Which metrics an AI visibility dashboard should include so teams can see progress, risks and next actions.',
  $en$## A dashboard should show what is changing

An AI visibility report can easily become a collection of interesting answers. A dashboard should do something more useful: show what is changing, why it is changing and what the team should do next.

The weakest dashboard shows only the latest ChatGPT answer. The strongest shows trends across prompts, models, competitors, citations and recommendations.

## Core metrics

For each brand, track mention rate, average rank, share of voice, citation count, owned citation share, accuracy score and recommendation strength.

These metrics are not perfect, but they create a shared language between marketing, SEO, product and leadership.

## Segment by model

Do not compress everything into one score. ChatGPT, Gemini, Claude and Google AI Overviews may use different sources and answer styles. The dashboard should separate results by model and prompt type.

For example, a brand may perform well in informational prompts but poorly in buying comparisons. A single average hides that.

## Competitors and sources

Leadership often understands the issue fastest when they see which competitor appears instead. Include top competitors by mentions, domains most often cited, prompts where you are absent, prompts where the description is wrong and recommended content improvements.

That turns AI visibility from an abstract trend into a practical backlog.

## Connect it to the editorial calendar

The dashboard should not sit apart from the team's work. If AI assistants do not understand your category, create an explanatory guide. If they do not cite your pages, improve the source. If a competitor wins because of comparison content, publish a comparison or buying guide.

Every metric should have a possible action.

## Reporting cadence

Weekly review works for the operating team. Monthly review is enough for leadership: mention progress, biggest risks, top competitors, new opportunities and completed actions.

A good LLM visibility dashboard does not try to prove that AI "works". It shows where buyers get answers without you and how to fix that.$en$,
  'LLM Visibility Dashboard: AI Visibility Metrics',
  'Track AI visibility metrics including mentions, rank, share of voice, citations, competitors and answer accuracy.'
);

SELECT "_seedSeoBlogPost"(
  'blog_post_b2b_ai_visibility_plan_2026',
  'seo-blog-2026-09-01-10',
  '2026-08-23 08:00:00',
  '30-dnevni-ai-visibility-plan',
  '30-dnevni AI visibility plan za B2B podjetja',
  'Prakticen 30-dnevni nacrt za B2B ekipe: izmerite trenutno AI vidnost, zapolnite vsebinske vrzeli in vzpostavite rutino.',
  $sl$## Zakaj zaceti s 30 dnevi

AI visibility je nova disciplina, vendar ne potrebuje sestmesečnega projekta za prvi rezultat. V 30 dneh lahko podjetje izmeri trenutno stanje, najde najvecje vrzeli, objavi prve popravke in vzpostavi merjenje, ki se ponavlja.

Pomembno je, da ne zacnete z velikim teoreticnim dokumentom. Zacnite z dejanskimi vprasanji kupcev in odgovori AI sistemov.

## Teden 1: osnovna meritev

Izberite en brand in pripravite 20 do 40 promptov. Pokrijte:

- definicije problema,
- primerjave resitev,
- izbiro ponudnika,
- alternative konkurentom,
- lokalni ali industrijski kontekst,
- vprasanja tik pred nakupom.

Nato izvedite test cez vec modelov. Zabelezite omembe, ranking, konkurente, citate in napake v opisih. To je osnovna linija.

## Teden 2: diagnoza vrzeli

Preglejte odgovore, kjer vas ni ali kjer ste opisani narobe. Vsako vrzel uvrstite v eno od skupin:

- manjka razlaga kategorije,
- manjka primerjava,
- manjka dokaz ali case study,
- javni podatki so zastareli,
- konkurencni viri so mocnejsi,
- produktni opis je prevec nejasen.

Ta diagnoza naj postane backlog, ne prezentacija.

## Teden 3: objava popravkov

Izberite tri do pet najvecjih vrzeli in jih popravite. To lahko pomeni novo FAQ sekcijo, primerjalni clanek, boljso produktno stran, metodolosko razlago, osvezen opis na partnerskih profilih ali case study.

Vsaka objava naj ima jasen namen: kateri prompt naj bi po tej spremembi dobil boljsi odgovor?

## Teden 4: ponovna meritev in rutina

Ponovite isti nabor promptov. Ne pricakujte, da se bo vse spremenilo takoj, ker crawl in indeksiranje potrebujeta cas. Vseeno boste pogosto videli, kateri odgovori so bolj tocni in kateri viri se zacnejo pojavljati.

Na koncu meseca nastavite rutino:

- tedenski AI visibility scan,
- mesecni pregled konkurentov,
- uredniski backlog iz promptov,
- kvartalni pregled pozicioniranja.

## Kaj je dober rezultat prvega meseca

Dober rezultat ni nujno 100 % omemb. Dober rezultat je jasnost: veste, pri katerih vprasanjih vas AI asistenti razumejo, kje vas ni, kateri konkurenti zmagujejo in katere vsebine morate ustvariti naslednje.

Za zacetek lahko uporabite [AI Visibility Radar](/ai-visibility-checker), potem pa merjenje razsirite na stalni nabor promptov za vsak pomemben brand.$sl$,
  '30-dnevni AI visibility plan za B2B podjetja',
  'Korak za korakom nacrt za merjenje AI vidnosti, pripravo promptov, analizo vrzeli in izboljsanje omemb v AI odgovorih.',
  '30-day-ai-visibility-plan',
  'A 30-Day AI Visibility Plan for B2B Companies',
  'A practical 30-day plan for B2B teams: measure AI visibility, close content gaps and build a repeatable routine.',
  $en$## Why start with 30 days

AI visibility is a new discipline, but it does not require a six-month project to create the first useful result. In 30 days a company can measure the current state, find major gaps, publish initial fixes and establish repeatable monitoring.

Do not begin with a large theoretical document. Begin with real buyer questions and real AI answers.

## Week 1: baseline measurement

Choose one brand and prepare 20 to 40 prompts. Cover problem definitions, solution comparisons, provider selection, alternatives to competitors, local or industry context and late-stage buying questions.

Run the test across several models. Record mentions, rank, competitors, citations and errors in the descriptions. This is your baseline.

## Week 2: diagnose gaps

Review answers where you are absent or described incorrectly. Classify each gap:

- missing category explanation,
- missing comparison,
- missing proof or case study,
- outdated public facts,
- stronger competitor sources,
- unclear product description.

The diagnosis should become a backlog, not a slide deck.

## Week 3: publish fixes

Choose three to five major gaps and fix them. This may mean a new FAQ section, comparison article, stronger product page, methodology explanation, updated partner profile or case study.

Every update should have a purpose: which prompt should receive a better answer because of this change?

## Week 4: measure again and build the habit

Run the same prompts again. Do not expect every result to change immediately, because crawling and indexing take time. Still, you will often see which answers become more accurate and which sources start appearing.

At the end of the month, create a routine: weekly AI visibility scans, monthly competitor review, an editorial backlog from prompts and a quarterly positioning review.

## What a good first month looks like

A good result is not necessarily 100 percent mentions. A good result is clarity: you know where AI assistants understand you, where you are absent, which competitors win and what content to create next.

Start with [AI Visibility Radar](/ai-visibility-checker), then expand measurement to a stable prompt set for each important brand.$en$,
  '30-Day AI Visibility Plan for B2B Companies',
  'A step-by-step plan for measuring AI visibility, creating prompts, diagnosing gaps and improving mentions in AI answers.'
);

DROP FUNCTION "_seedSeoBlogPost"(
  TEXT,
  TEXT,
  TIMESTAMP,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
);
