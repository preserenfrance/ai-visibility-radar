import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  type SupportedLocale,
  normalizeLocale,
} from "@ai-radar/shared";

export const dictionaries = {
  sl: {
    metadata: {
      description:
        "Merjenje AI vidnosti znamke v ChatGPT, Gemini in Claude: omembe, konkurenti, citati, trendi in javni AI pogled na ponudbo.",
    },
    common: {
      brand: "AI Visibility Radar",
      language: "Jezik",
      openMenu: "Odpri meni",
      home: "Domov",
      faq: "FAQ",
      blog: "Blog",
      contact: "Kontakt",
      privacy: "Zasebnost",
      pricing: "Cenik",
      mcp: "MCP",
      login: "Vstop",
      logout: "Odjava",
      email: "Email",
      password: "Geslo",
      loading: "Nalagam",
      save: "Shrani",
      backToLogin: "Nazaj na prijavo",
      freeAudit: "Brezplačen pregled",
    },
    localeNames: {
      sl: "Slovenščina",
      en: "English",
    },
    nav: {
      myBrands: "Moje znamke",
      newBrand: "Nova znamka",
      admin: "Admin",
      operations: "Operacije",
      monitor: "Monitor",
      analytics: "Analitika",
      faqAdmin: "FAQ admin",
      prompts: "Prompti",
      settings: "Nastavitve",
    },
    brandMenu: {
      aria: "Meni znamke",
      overview: "Osnovni prikaz",
      prompts: "Prompti",
      competitors: "Konkurenti",
      citations: "Citati",
      actions: "Ideje za izboljšanje",
    },
    footer: {
      rights: "Portal je v lasti SEOS group d.o.o. Vse pravice pridržane.",
    },
    home: {
      eyebrow: "Brezplačen prvi AI pregled",
      headline: "Preveri, kako AI pomočniki vidijo tvojo znamko.",
      intro:
        "AI Visibility Radar pokaže, ali se tvoja znamka pojavi v AI odgovorih, kateri konkurenti dobijo več prostora, katere vire modeli uporabljajo in kako ChatGPT javno razume tvojo ponudbo. Prvi pregled uporabi ChatGPT, v aplikaciji pa lahko redno spremljaš tudi rezultate iz Gemini, Claude in modelov z iskanjem.",
      primaryCta: "Zaženi prvi pregled",
      appCta: "Odpri aplikacijo",
      sampleEyebrow: "Primer pregleda",
      sampleTitle: "Vidnost znamke",
      live: "v živo",
      metricsTitle: "Kaj dobiš",
      heroChecks: [
        "Omembe znamke v AI odgovorih",
        "Primerjava z najbližjimi konkurenti",
        "ChatGPT pogled na ponudbo in javne zadržke",
      ],
      measureEyebrow: "Kaj meri",
      measureTitle:
        "AI vidnost je nova plast odločanja. Radar jo naredi merljivo.",
      measureText:
        "Kupci vedno pogosteje vprašajo AI model, katero podjetje izbrati, katero rešitev primerjati ali komu lahko zaupajo. Če te model ne pozna, te ne citira ali te predstavi slabše od konkurence, izgubljaš povpraševanja, še preden pridejo do tvoje strani. Radar zato združi omembe, rang, citate, konkurente in jasen pregled, kaj AI že ve o tvoji znamki.",
      sectionStepsEyebrow: "Kako deluje",
      sectionStepsTitle: "Od vprašanj kupcev do jasnega načrta izboljšav.",
      sectionStepsText:
        "Pregled je pripravljen tako, da ga razumejo marketing, prodaja in vodstvo. Ne dobiš samo številke, ampak razlago, zakaj je rezultat takšen, pri katerih vprašanjih izgubljaš, katere domene se pojavljajo pri konkurenci in kje je najhitrejši napredek.",
      resultsEyebrow: "Primer rezultatov",
      resultsTitle: "Vidiš ne samo, ali si omenjen, ampak zakaj.",
      resultsText:
        "Pregled poveže vprašanje, odgovor modela, rang znamke, citacije, sentiment, konkurente in časovni trend. Tako hitro ločiš med težavo v vsebini, avtoriteti vira, pozicioniranju ali jasnosti ponudbe.",
      resultChecks: [
        "Vprašanja po fazah nakupne poti",
        "Top konkurenti, ki se ponavljajo v odgovorih",
        "Viri, ki jih modeli uporabljajo kot dokaz",
        "AI vpogledi v ponudbo in javne pripombe",
      ],
      scoreTitle: "Ocena AI vidnosti",
      scoreRows: [
        { label: "Omembe znamke", value: "8 od 12 vprašanj" },
        { label: "Povprečni rang", value: "2. mesto" },
        { label: "Najmočnejši vir", value: "strokovni vodič" },
        { label: "Največja vrzel", value: "primerjalna vsebina" },
      ],
      useCasesEyebrow: "Za koga je",
      useCasesTitle: "Za ekipe, ki želijo vedeti, kaj AI modeli povedo o njih.",
      useCasesText:
        "Radar je uporaben za podjetja, ki že vlagajo v SEO, vsebino, PR ali prodajo in želijo preveriti, ali se ta trud pozna tudi v odgovorih generativnih iskalnikov.",
      checkQuestions: "Preveri svoja vprašanja",
      seePricing: "Poglej cenik",
      reviewsEyebrow: "Mnenja",
      reviewsTitle: "Mnenja uporabnikov in ekip, ki spremljajo AI vidnost.",
      reviewsText:
        "Največ vrednosti nastane takrat, ko ekipa vidi konkretne vprašanja, konkurente in vire, ne samo ene abstraktne ocene. Zato so rezultati pripravljeni za pogovor med marketingom, SEO, prodajo in vodstvom.",
      startFirstScan: "Začni prvi pregled",
      bottomEyebrow: "Prvi pregled je brezplačen",
      bottomTitle: "Poglej, kako te AI modeli vidijo danes.",
      bottomText:
        "Vnesi domeno in 3 do 5 testnih vprašanj, prejmi osnovno oceno AI vidnosti in odkrij, katere vsebine, citate, primerjave in razlage ponudbe je smiselno najprej izboljšati.",
      features: [
        {
          title: "Meritev omemb",
          description:
            "Preveri, ali se tvoja znamka pojavi v odgovorih ChatGPT, Gemini, Claude in modelih z iskanjem.",
        },
        {
          title: "Rang med konkurenti",
          description:
            "Radar pokaže, kdo je v AI odgovorih pred tabo, katere domene se najpogosteje ponavljajo in pri katerih vprašanjih izgubljaš vidnost.",
        },
        {
          title: "Citirani viri",
          description:
            "Vidiš, katere strani AI modeli navajajo kot dokaz in kje moraš okrepiti avtoriteto.",
        },
        {
          title: "AI pogled na znamko",
          description:
            "Za vsako znamko dobiš povzetek, kako jo ChatGPT razume, kateri produkti ali storitve so najbolj izpostavljeni in kateri javni zadržki se ponavljajo.",
        },
        {
          title: "Naloge za izboljšave",
          description:
            "Vsak pregled se zaključi s konkretnimi vsebinskimi, citacijskimi in pozicijskimi priporočili.",
        },
        {
          title: "Redno spremljanje",
          description:
            "Tedenski avtomatski pregledi pokažejo, ali se vidnost izboljšuje ali konkurenca prevzema prostor v AI odgovorih.",
        },
      ],
      steps: [
        {
          title: "Vneseš 3 do 5 testnih vprašanj",
          description:
            "Sam določiš vprašanja kupcev ali jih pustiš predlagati Radarju glede na domeno, trg in konkurente.",
        },
        {
          title: "Modeli dobijo tvoja vprašanja",
          description:
            "Brezplačni pregled uporabi ChatGPT, v aplikaciji pa lahko isto logiko uporabljaš še za Gemini, Claude in modele z iskanjem.",
        },
        {
          title: "Dobiš rezultat in prioritete",
          description:
            "Rezultat poveže oceno, omembe, rang, citate, konkurenco, vpogled v znamko in naslednje korake.",
        },
      ],
      useCases: [
        "SEO in vsebinske ekipe, ki želijo poleg Googlovih pozicij meriti tudi AI odgovore.",
        "B2B podjetja, kjer se kupci pred kontaktom najprej informirajo v ChatGPT, Gemini ali Claude.",
        "Agencije, ki želijo strankam pokazati jasen dokaz, kje jih AI modeli prehitevajo ali narobe razumejo.",
        "Vodstva, ki potrebujejo preprosto oceno, trend konkurence in seznam prioritet brez branja tehničnih logov.",
      ],
      reviews: [
        {
          name: "Maja, vodja marketinga",
          company: "B2B SaaS ekipa",
          text: "Končno smo videli, zakaj nas AI priporoča pri nekaterih vprašanjih, pri drugih pa sploh ne. Najbolj uporabni so bili konkretni naslednji koraki.",
          rating: 5,
        },
        {
          name: "Tomaž, SEO svetovalec",
          company: "Digitalna agencija",
          text: "Pregled je dober pogovor s stranko odprl v petih minutah. Ocena, konkurenti in citirani viri so precej bolj razumljivi kot surov seznam vprašanj.",
          rating: 5,
        },
        {
          name: "Nina, ustanoviteljica",
          company: "Storitveno podjetje",
          text: "Najprej sem mislila, da gre samo za še eno poročilo. Potem sem videla, kateri konkurenti se ponavljajo v odgovorih, in takoj vedela, kaj moramo popraviti.",
          rating: 5,
        },
      ],
      metrics: [
        { label: "Ocena AI vidnosti", value: "0-100" },
        { label: "Vprašanja v pregledu", value: "3-5" },
        { label: "Primerjava modelov", value: "3+" },
        { label: "Poročilo", value: "takoj" },
      ],
    },
    pricing: {
      title: "Cenik",
      intro:
        "Vsi deli aplikacije so dostopni v vseh paketih. Paketi se razlikujejo po številu znamk, številu aktivnih vprašanj in številu ročnih pregledov na mesec. Avtomatski tedenski pregledi, konkurenti, citati in osnovni AI vpogledi so vključeni v vseh paketih.",
      feature: "Funkcionalnost",
      start: "Začni",
      home: "Domov",
      included: "Vključeno",
      plans: {
        free: {
          name: "Brezplačno",
          price: "0 €",
          cta: "Začni brezplačen pregled",
        },
        starter: {
          name: "Starter",
          price: "15,99 € / mesec",
          cta: "Izberi Starter",
        },
        growth: {
          name: "Growth",
          price: "39,99 € / mesec",
          cta: "Izberi Growth",
        },
      },
      features: [
        ["Znamke", { free: 1, starter: 1, growth: 3 }],
        ["Aktivna vprašanja na znamko", { free: 10, starter: 25, growth: 100 }],
        ["Ročni pregledi na mesec", { free: 0, starter: 4, growth: 15 }],
        ["Ročni pregledi", { free: false, starter: true, growth: true }],
        [
          "Avtomatski tedenski pregledi",
          { free: "tedensko", starter: "tedensko", growth: "tedensko" },
        ],
        ["Vsi zavihki in moduli", { free: true, starter: true, growth: true }],
        [
          "Konkurenti, citati in priporočila",
          { free: true, starter: true, growth: true },
        ],
        [
          "Modeli in iskalni pogledi",
          { free: true, starter: true, growth: true },
        ],
        [
          "ChatGPT pogled na znamko in ponudbo",
          { free: true, starter: true, growth: true },
        ],
      ] as Array<
        [
          string,
          Record<"free" | "starter" | "growth", boolean | string | number>,
        ]
      >,
    },
    checker: {
      headline: "Preveri, kako ChatGPT vidi tvojo znamko.",
      intro:
        "Brezplačni pregled uporabi 3 do 5 vprašanj, ki jih vneseš sam ali jih predlaga Radar. ChatGPT odgovore pretvori v začetno oceno AI vidnosti, prikaže omembe znamke, konkurente in vire, v aplikaciji pa lahko pozneje spremljaš tudi rezultate iz Gemini, Claude in modelov z iskanjem.",
      title: "Zaženi brezplačen pregled",
      errors: {
        openai:
          "Pregleda trenutno ni bilo mogoče zagnati, ker OpenAI API ni pravilno nastavljen ali nima dovolj kvote. Na Vercelu preveri OPENAI_API_KEY in po želji OPENAI_MODEL.",
        prompts:
          "Za pregled moraš vnesti vsaj 3 in največ 5 vprašanj, vsako z vsaj 3 znaki.",
        database:
          "Pregleda trenutno ni bilo mogoče zagnati, ker povezava z bazo ali migracije niso pripravljene. Preveri Vercel okoljske spremenljivke in produkcijsko bazo.",
        schema:
          "Pregleda trenutno ni bilo mogoče zagnati, ker produkcijska baza še nima vseh tabel ali stolpcev. Zaženi Prisma db push na Supabase bazo.",
        pooler:
          "Pregleda trenutno ni bilo mogoče zagnati zaradi Supabase pooler povezave. Za DATABASE_URL uporabi POSTGRES_PRISMA_URL oziroma Transaction pooler z nastavljenim pgbouncer=true.",
        timeout:
          "Pregled je trajal predolgo. Poskusi z drugo domeno ali ponovno čez nekaj minut.",
        unknown:
          "Pregleda trenutno ni bilo mogoče zagnati. Preveri Vercel Function loge za natančen razlog in poskusi ponovno.",
      },
    },
    freeAuditForm: {
      domain: "Spletna stran",
      domainPlaceholder: "domain.com",
      brandName: "Ime znamke",
      brandNamePlaceholder: "Npr. Moja trgovina",
      emailPlaceholder: "ime@podjetje.si",
      language: "Jezik odgovorov",
      competitors: "Konkurenti",
      competitorsPlaceholder: "Npr. Mimovrste, Merkur, Bauhaus",
      competitorsHelp:
        "Vnesi imena konkurenčnih znamk, ki jih želiš primerjati s svojo znamko. Če jih je več, jih loči z vejico.",
      questionsLegend: "Vnesi vsaj {min} in največ {max} vprašanj za test",
      suggestionsHelp: "Predloge lahko po generiranju še spremeniš.",
      suggest: "Predlagaj vprašanja",
      suggesting: "Pripravljam predloge",
      missingDomain: "Najprej vnesi domeno in ime znamke.",
      noSuggestions: "ChatGPT ni vrnil predlogov.",
      suggestionsError:
        "Predlogov trenutno ni bilo mogoče pripraviti. Poskusi ponovno ali jih vpiši ročno.",
      promptWarningTitle: "Za pregled potrebuješ vsaj 3 vprašanja.",
      promptWarningText:
        "Vpiši še eno vprašanje ali klikni spodnji gumb in ti pripravimo predloge, ki jih lahko pregledaš in popraviš.",
      question: "Vprašanje {number}",
      modelsLegend: "Izberi AI modele za test",
      availableInApp: "V aplikaciji",
      submit: "Zaženi brezplačen pregled",
      pending: "Pripravljamo prvo poročilo",
      runningTitle: "Pregled teče v ozadju",
      runningText:
        "Pošiljamo tvoja vprašanja izbranemu AI modelu in pripravljamo rezultat. To lahko traja nekaj trenutkov.",
      placeholders: [
        "Npr. Katera spletna trgovina je najboljša izbira za nakup kakovostnih tekaških copat v Sloveniji?",
        "Npr. Primerjaj spletne trgovine z otroško opremo glede na ceno, dostavo in vračila.",
        "Npr. Kje lahko kupim zanesljiv robotski sesalnik z dobro garancijo in hitro dostavo?",
        "Npr. Katere spletne trgovine priporočate za nakup naravne kozmetike v Sloveniji?",
        "Npr. Katera spletna trgovina ima najboljšo ponudbo pohištva za manjša stanovanja?",
      ],
    },
    auth: {
      loginTitle: "Prijava",
      invalidLogin: "Email ali geslo ni pravilno.",
      resetOk: "Geslo je bilo uspešno spremenjeno. Zdaj se lahko prijaviš.",
      forgotPassword: "Pozabljeno geslo?",
      createAccount: "Ustvari račun",
      signupTitle: "Ustvari račun",
      namePlaceholder: "Ime in priimek",
      organizationPlaceholder: "Ime organizacije",
      passwordHelp:
        "Geslo mora vsebovati vsaj 8 znakov. Posebni znaki niso obvezni.",
      repeatPassword: "Ponovi geslo",
      scanConsent:
        "Želim prejemati e-mail obvestila o zaključenih scanih in novih rezultatih.",
      marketingConsent:
        "Strinjam se s prejemanjem marketinških obvestil, novosti in nasvetov za izboljšanje AI vidnosti.",
      alreadyHaveAccount: "Že imaš račun?",
      signupLink: "Prijava",
      errors: {
        short: "Geslo mora imeti vsaj 8 znakov.",
        mismatch: "Gesli se ne ujemata.",
        exists:
          "Račun s tem emailom že obstaja. Poskusi s prijavo ali ponastavitvijo gesla.",
        signupDefault: "Računa trenutno ni bilo mogoče ustvariti.",
      },
      forgotTitle: "Pozabljeno geslo",
      forgotSent:
        "Če račun obstaja, smo poslali povezavo za ponastavitev gesla.",
      devLink: "Razvojna povezava:",
      emailNotConfigured:
        "Pošiljanje emailov ni nastavljeno. Na Vercelu dodaj `RESEND_API_KEY`.",
      sendResetLink: "Pošlji povezavo",
      rememberPassword: "Se spomniš gesla?",
      resetTitle: "Nastavi novo geslo",
      invalidResetLink: "Povezava za ponastavitev gesla ni veljavna.",
      requestNewLink: "Zahtevaj novo povezavo",
      newPassword: "Novo geslo",
      repeatNewPassword: "Ponovi novo geslo",
      saveNewPassword: "Shrani novo geslo",
      resetErrors: {
        invalid: "Povezava za ponastavitev ni veljavna ali je potekla.",
        default: "Gesla trenutno ni bilo mogoče spremeniti.",
      },
    },
    contact: {
      eyebrow: "Kontakt",
      title: "Pišite nam",
      intro:
        "Za vprašanja o AI Visibility Radarju, paketih, poročilih ali podpori smo dosegljivi na",
      formTitle: "Kontaktni obrazec",
      namePlaceholder: "Ime in priimek",
      subjectPlaceholder: "Zadeva",
      messagePlaceholder: "Kako vam lahko pomagamo?",
      submit: "Pošlji sporočilo",
      status: {
        sent: "Sporočilo je poslano. Odgovorimo čim prej.",
        missing: "Izpolnite vsa obvezna polja.",
        failed:
          "Sporočila trenutno ni bilo mogoče poslati. Lahko nam pišete neposredno na hey@llmvisio.com.",
      },
    },
    backend: {
      invalidRequest: "Neveljavna vsebina zahtevka",
      forbidden: "Nimate dovoljenja za ta dostop.",
      unauthorized: "Za nadaljevanje se prijavite.",
      unexpected: "Nepričakovana napaka strežnika",
    },
  },
  en: {
    metadata: {
      description:
        "Measure brand visibility in ChatGPT, Gemini and Claude: mentions, competitors, citations, trends and the public AI view of your offer.",
    },
    common: {
      brand: "AI Visibility Radar",
      language: "Language",
      openMenu: "Open menu",
      home: "Home",
      faq: "FAQ",
      blog: "Blog",
      contact: "Contact",
      privacy: "Privacy",
      pricing: "Pricing",
      mcp: "MCP",
      login: "Log in",
      logout: "Log out",
      email: "Email",
      password: "Password",
      loading: "Loading",
      save: "Save",
      backToLogin: "Back to login",
      freeAudit: "Free audit",
    },
    localeNames: {
      sl: "Slovenščina",
      en: "English",
    },
    nav: {
      myBrands: "My brands",
      newBrand: "New brand",
      admin: "Admin",
      operations: "Operations",
      monitor: "Monitor",
      analytics: "Analytics",
      faqAdmin: "FAQ admin",
      prompts: "Prompts",
      settings: "Settings",
    },
    brandMenu: {
      aria: "Brand menu",
      overview: "Overview",
      prompts: "Prompts",
      competitors: "Competitors",
      citations: "Citations",
      actions: "Improvement ideas",
    },
    footer: {
      rights: "The portal is owned by SEOS group d.o.o. All rights reserved.",
    },
    home: {
      eyebrow: "Free first AI audit",
      headline: "See how AI assistants understand your brand.",
      intro:
        "AI Visibility Radar shows whether your brand appears in AI answers, which competitors get more visibility, which sources models cite, and how ChatGPT publicly understands your offer. The first audit uses ChatGPT; inside the app you can also track Gemini, Claude and search-enabled models.",
      primaryCta: "Start first audit",
      appCta: "Open app",
      sampleEyebrow: "Audit example",
      sampleTitle: "Brand visibility",
      live: "live",
      metricsTitle: "What you get",
      heroChecks: [
        "Brand mentions in AI answers",
        "Comparison with closest competitors",
        "ChatGPT view of the offer and public concerns",
      ],
      measureEyebrow: "What it measures",
      measureTitle:
        "AI visibility is a new layer of decision-making. Radar makes it measurable.",
      measureText:
        "Buyers increasingly ask AI models which company to choose, which solution to compare or who they can trust. If the model does not know you, does not cite you, or presents you worse than competitors, you lose demand before visitors reach your site. Radar combines mentions, rank, citations, competitors and a clear view of what AI already knows about your brand.",
      sectionStepsEyebrow: "How it works",
      sectionStepsTitle: "From buyer questions to a clear improvement plan.",
      sectionStepsText:
        "The audit is built so marketing, sales and leadership can understand it. You do not only get a number, but an explanation of why the score looks the way it does, which questions you lose, which domains appear for competitors and where progress is fastest.",
      resultsEyebrow: "Result example",
      resultsTitle: "See not only whether you are mentioned, but why.",
      resultsText:
        "The audit connects the question, model answer, brand rank, citations, sentiment, competitors and time trend. You can quickly separate content problems from source authority, positioning or offer clarity.",
      resultChecks: [
        "Questions by buying journey stage",
        "Top competitors that repeat in answers",
        "Sources models use as evidence",
        "AI insights into the offer and public objections",
      ],
      scoreTitle: "AI visibility score",
      scoreRows: [
        { label: "Brand mentions", value: "8 of 12 questions" },
        { label: "Average rank", value: "2nd place" },
        { label: "Strongest source", value: "expert guide" },
        { label: "Biggest gap", value: "comparison content" },
      ],
      useCasesEyebrow: "Who it is for",
      useCasesTitle:
        "For teams that need to know what AI models say about them.",
      useCasesText:
        "Radar is useful for companies already investing in SEO, content, PR or sales and wanting to check whether that work shows up in generative search answers.",
      checkQuestions: "Check your questions",
      seePricing: "See pricing",
      reviewsEyebrow: "Testimonials",
      reviewsTitle: "What users and teams say about tracking AI visibility.",
      reviewsText:
        "The biggest value appears when teams see concrete questions, competitors and sources, not just an abstract score. Results are built for discussions across marketing, SEO, sales and leadership.",
      startFirstScan: "Start first audit",
      bottomEyebrow: "The first audit is free",
      bottomTitle: "See how AI models understand you today.",
      bottomText:
        "Enter a domain and 3 to 5 test questions, receive an initial AI visibility score, and uncover which content, citations, comparisons and offer explanations should be improved first.",
      features: [
        {
          title: "Mention tracking",
          description:
            "Check whether your brand appears in ChatGPT, Gemini, Claude and search-enabled model answers.",
        },
        {
          title: "Rank among competitors",
          description:
            "Radar shows who appears ahead of you, which domains repeat most often, and which questions cost you visibility.",
        },
        {
          title: "Cited sources",
          description:
            "See which pages AI models cite as evidence and where your authority needs to be stronger.",
        },
        {
          title: "AI view of your brand",
          description:
            "For each brand you get a summary of how ChatGPT understands it, which products or services stand out, and which public concerns repeat.",
        },
        {
          title: "Improvement tasks",
          description:
            "Every scan ends with concrete recommendations for content, citations and positioning.",
        },
        {
          title: "Ongoing monitoring",
          description:
            "Weekly automatic scans show whether visibility is improving or competitors are taking more space in AI answers.",
        },
      ],
      steps: [
        {
          title: "Enter 3 to 5 test questions",
          description:
            "Use your own buyer questions or let Radar suggest them from your domain, market and competitors.",
        },
        {
          title: "Models answer your questions",
          description:
            "The free audit uses ChatGPT. In the app, the same workflow can run across Gemini, Claude and search-enabled models.",
        },
        {
          title: "Get a score and priorities",
          description:
            "The result connects score, mentions, rank, citations, competition, brand insight and next steps.",
        },
      ],
      useCases: [
        "SEO and content teams that want to measure AI answers alongside Google rankings.",
        "B2B companies where buyers research in ChatGPT, Gemini or Claude before making contact.",
        "Agencies that need clear evidence of where AI models outrank or misunderstand clients.",
        "Leadership teams that need a simple score, competitor trend and priority list without reading technical logs.",
      ],
      reviews: [
        {
          name: "Maja, Head of Marketing",
          company: "B2B SaaS team",
          text: "We finally saw why AI recommends us for some questions and not at all for others. The concrete next steps were the most useful part.",
          rating: 5,
        },
        {
          name: "Tomaž, SEO consultant",
          company: "Digital agency",
          text: "The audit opened a good client conversation in five minutes. The score, competitors and cited sources are far easier to understand than a raw list of questions.",
          rating: 5,
        },
        {
          name: "Nina, founder",
          company: "Service business",
          text: "At first I thought it was just another report. Then I saw which competitors kept appearing in the answers and immediately knew what we needed to fix.",
          rating: 5,
        },
      ],
      metrics: [
        { label: "AI visibility score", value: "0-100" },
        { label: "Questions per audit", value: "3-5" },
        { label: "Model comparison", value: "3+" },
        { label: "Report", value: "instant" },
      ],
    },
    pricing: {
      title: "Pricing",
      intro:
        "All parts of the app are available on every plan. Plans differ by the number of brands, active questions and manual scans per month. Automatic weekly scans, competitors, citations and core AI insights are included in every plan.",
      feature: "Feature",
      start: "Start",
      home: "Home",
      included: "Included",
      plans: {
        free: { name: "Free", price: "€0", cta: "Start free audit" },
        starter: {
          name: "Starter",
          price: "€15.99 / month",
          cta: "Choose Starter",
        },
        growth: {
          name: "Growth",
          price: "€39.99 / month",
          cta: "Choose Growth",
        },
      },
      features: [
        ["Brands", { free: 1, starter: 1, growth: 3 }],
        ["Active questions per brand", { free: 10, starter: 25, growth: 100 }],
        ["Manual scans per month", { free: 0, starter: 4, growth: 15 }],
        ["Manual scans", { free: false, starter: true, growth: true }],
        [
          "Automatic weekly scans",
          { free: "weekly", starter: "weekly", growth: "weekly" },
        ],
        ["All tabs and modules", { free: true, starter: true, growth: true }],
        [
          "Competitors, citations and recommendations",
          { free: true, starter: true, growth: true },
        ],
        [
          "Models and search views",
          { free: true, starter: true, growth: true },
        ],
        [
          "ChatGPT brand and offer insight",
          { free: true, starter: true, growth: true },
        ],
      ] as Array<
        [
          string,
          Record<"free" | "starter" | "growth", boolean | string | number>,
        ]
      >,
    },
    checker: {
      headline: "See how ChatGPT understands your brand.",
      intro:
        "The free audit uses 3 to 5 questions you enter yourself or let Radar suggest. ChatGPT answers are turned into an initial AI visibility score with brand mentions, competitors and sources. Later in the app, you can also track Gemini, Claude and search-enabled models.",
      title: "Start free audit",
      errors: {
        openai:
          "The audit could not start because the OpenAI API is not configured correctly or has insufficient quota. Check OPENAI_API_KEY and optionally OPENAI_MODEL on Vercel.",
        prompts:
          "Enter at least 3 and at most 5 questions, each with at least 3 characters.",
        database:
          "The audit could not start because the database connection or migrations are not ready. Check Vercel environment variables and the production database.",
        schema:
          "The audit could not start because the production database is missing tables or columns. Run Prisma db push on the Supabase database.",
        pooler:
          "The audit could not start because of the Supabase pooler connection. Use POSTGRES_PRISMA_URL or the Transaction pooler with pgbouncer=true for DATABASE_URL.",
        timeout:
          "The audit took too long. Try another domain or try again in a few minutes.",
        unknown:
          "The audit could not start. Check Vercel Function logs for the exact reason and try again.",
      },
    },
    freeAuditForm: {
      domain: "Website",
      domainPlaceholder: "domain.com",
      brandName: "Brand name",
      brandNamePlaceholder: "E.g. My store",
      emailPlaceholder: "name@company.com",
      language: "Answer language",
      competitors: "Competitors",
      competitorsPlaceholder: "E.g. Amazon, Shopify, Zalando",
      competitorsHelp:
        "Enter competing brands you want to compare with your own. Separate multiple names with commas.",
      questionsLegend: "Enter at least {min} and at most {max} test questions",
      suggestionsHelp: "You can edit suggestions after they are generated.",
      suggest: "Suggest questions",
      suggesting: "Preparing suggestions",
      missingDomain: "Enter the domain and brand name first.",
      noSuggestions: "ChatGPT did not return suggestions.",
      suggestionsError:
        "Suggestions could not be prepared right now. Try again or enter them manually.",
      promptWarningTitle: "The audit needs at least 3 questions.",
      promptWarningText:
        "Enter one more question or click the button below and we will prepare suggestions you can review and edit.",
      question: "Question {number}",
      modelsLegend: "Choose AI models for the test",
      availableInApp: "In the app",
      submit: "Start free audit",
      pending: "Preparing the first report",
      runningTitle: "Audit is running in the background",
      runningText:
        "We are sending your questions to the selected AI model and preparing the result. This may take a few moments.",
      placeholders: [
        "E.g. Which online store is the best choice for buying quality running shoes?",
        "E.g. Compare online stores for baby equipment by price, delivery and returns.",
        "E.g. Where can I buy a reliable robot vacuum with a good warranty and fast delivery?",
        "E.g. Which online stores do you recommend for natural cosmetics?",
        "E.g. Which online store has the best furniture selection for smaller apartments?",
      ],
    },
    auth: {
      loginTitle: "Log in",
      invalidLogin: "Email or password is incorrect.",
      resetOk: "Your password has been changed. You can now log in.",
      forgotPassword: "Forgot password?",
      createAccount: "Create account",
      signupTitle: "Create account",
      namePlaceholder: "Full name",
      organizationPlaceholder: "Organization name",
      passwordHelp:
        "Password must contain at least 8 characters. Special characters are optional.",
      repeatPassword: "Repeat password",
      scanConsent:
        "I want to receive email notifications about completed scans and new results.",
      marketingConsent:
        "I agree to receive marketing emails, product news and tips for improving AI visibility.",
      alreadyHaveAccount: "Already have an account?",
      signupLink: "Log in",
      errors: {
        short: "Password must have at least 8 characters.",
        mismatch: "Passwords do not match.",
        exists:
          "An account with this email already exists. Try logging in or resetting your password.",
        signupDefault: "The account could not be created right now.",
      },
      forgotTitle: "Forgot password",
      forgotSent: "If the account exists, we sent a password reset link.",
      devLink: "Development link:",
      emailNotConfigured:
        "Email sending is not configured. Add `RESEND_API_KEY` on Vercel.",
      sendResetLink: "Send link",
      rememberPassword: "Remember your password?",
      resetTitle: "Set a new password",
      invalidResetLink: "The password reset link is not valid.",
      requestNewLink: "Request a new link",
      newPassword: "New password",
      repeatNewPassword: "Repeat new password",
      saveNewPassword: "Save new password",
      resetErrors: {
        invalid: "The reset link is invalid or has expired.",
        default: "The password could not be changed right now.",
      },
    },
    contact: {
      eyebrow: "Contact",
      title: "Get in touch",
      intro:
        "For questions about AI Visibility Radar, plans, reports or support, you can reach us at",
      formTitle: "Contact form",
      namePlaceholder: "Full name",
      subjectPlaceholder: "Subject",
      messagePlaceholder: "How can we help?",
      submit: "Send message",
      status: {
        sent: "Message sent. We will reply as soon as possible.",
        missing: "Please fill in all required fields.",
        failed:
          "The message could not be sent right now. You can email us directly at hey@llmvisio.com.",
      },
    },
    backend: {
      invalidRequest: "Invalid request body",
      forbidden: "You do not have permission to access this.",
      unauthorized: "Please log in to continue.",
      unexpected: "Unexpected server error",
    },
  },
} as const;

export type Dictionary = (typeof dictionaries)[SupportedLocale];

export async function getRequestLocale(): Promise<SupportedLocale> {
  const headerStore = await headers();
  const pathLocale = headerStore.get("x-ai-radar-locale");
  if (pathLocale) return normalizeLocale(pathLocale);

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (cookieLocale) return normalizeLocale(cookieLocale);

  return normalizeLocale(headerStore.get("accept-language"));
}

export async function getI18n(locale?: SupportedLocale) {
  const resolvedLocale = locale ?? (await getRequestLocale());
  return {
    locale: resolvedLocale,
    dictionary: dictionaries[resolvedLocale],
  };
}

export function getDictionary(locale: SupportedLocale = DEFAULT_LOCALE) {
  return dictionaries[locale];
}

export function replaceParams(
  value: string,
  params: Record<string, string | number>,
) {
  return Object.entries(params).reduce(
    (result, [key, replacement]) =>
      result.replaceAll(`{${key}}`, String(replacement)),
    value,
  );
}
