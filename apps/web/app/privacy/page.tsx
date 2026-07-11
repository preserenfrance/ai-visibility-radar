import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getI18n } from "@/lib/i18n";

const privacyCopy = {
  sl: {
    eyebrow: "Politika zasebnosti",
    title: "Zasebnost in piškotki",
    updatedAt: "11. julij 2026",
    updatedLabel: "Zadnja posodobitev",
    sections: [
      {
        title: "1. Upravljavec in kontakt",
        body: [
          "Upravljavec osebnih podatkov za storitev LLM Visio oziroma AI Visibility Radar je SEOS group d.o.o. Za vprašanja o zasebnosti, uveljavljanje pravic ali odjavo od obvestil nam lahko pišete na hey@llmvisio.com.",
        ],
      },
      {
        title: "2. Katere podatke obdelujemo",
        body: [
          "Ob registraciji obdelujemo e-mail naslov, ime, geslo v zgoščeni obliki, podatke o organizaciji, paket in nastavitve e-mail obvestil.",
          "Pri uporabi storitve obdelujemo podatke o znamkah, domenah, konkurentih, promptih, rezultatih scanov, AI odgovorih, citatih, priporočilih, statusih operacij in osnovnih tehničnih dnevnikih.",
          "Pri brezplačnem auditu obdelujemo e-mail, domeno, ime znamke, izbrane prompte, konkurente in rezultat audita. Pri kontaktu obdelujemo ime, e-mail, zadevo in vsebino sporočila.",
          "Pri plačilih lahko obdelujemo podatke o naročnini, statusu plačila in identifikatorjih plačilnega ponudnika. Celotnih podatkov plačilne kartice ne hranimo v aplikaciji.",
        ],
      },
      {
        title: "3. Nameni in pravne podlage",
        body: [
          "Podatke obdelujemo za ustvarjanje in upravljanje računa, izvajanje scanov, prikaz rezultatov, pripravo priporočil, pošiljanje transakcijskih obvestil, podporo uporabnikom, varnost aplikacije, obračunavanje paketov in izboljševanje storitve.",
          "Pravne podlage so izvajanje pogodbe oziroma koraki pred sklenitvijo pogodbe, zakoniti interes za varnost in izboljšave, izpolnjevanje zakonskih obveznosti ter privolitev, kadar gre za marketinška obvestila ali neobvezne komunikacije.",
          "Privolitev lahko kadarkoli prekličete prek povezave za odjavo v e-mailu ali s sporočilom na hey@llmvisio.com. Preklic ne vpliva na zakonitost obdelave pred preklicem.",
        ],
      },
      {
        title: "4. E-mail obvestila",
        body: [
          "Ob registraciji lahko ločeno izberete, ali želite prejemati marketinška obvestila in ali želite prejemati e-mail obvestila o scanih oziroma novih rezultatih.",
          "Vsak e-mail, kjer je to primerno, vsebuje povezavo za upravljanje nastavitev ali odjavo. Tudi po odjavi lahko še vedno prejmete nujna servisna sporočila, kadar so potrebna za varnost računa, ponastavitev gesla ali izpolnitev vaše zahteve.",
        ],
      },
      {
        title: "5. Obdelovalci in zunanji ponudniki",
        body: [
          "Za delovanje storitve uporabljamo ponudnike gostovanja, baze podatkov, e-mail pošiljanja, plačil, analitike, oglaševalskega merjenja, avtomatizacij in AI modelov. To lahko vključuje Vercel, Supabase oziroma PostgreSQL infrastrukturo, Resend, Stripe, Meta oziroma Facebook Pixel, Make.com, OpenAI, Google Gemini in Anthropic Claude.",
          "Pri AI ponudnikih obdelujemo predvsem prompte, podatke o znamki, domeni, konkurentih in javno dostopne vsebine, potrebne za izvedbo scana. Obseg poslanih podatkov omejujemo na tisto, kar je potrebno za rezultat.",
          "Z obdelovalci uporabljamo pogodbene in tehnične ukrepe, ki so namenjeni varovanju osebnih podatkov.",
        ],
      },
      {
        title: "6. Hramba, varnost in pravice",
        body: [
          "Podatke hranimo toliko časa, kot je potrebno za izvajanje storitve, podporo, varnost, analitiko in izpolnjevanje zakonskih obveznosti. Podatke računa in scanov praviloma hranimo, dokler je račun aktiven oziroma dokler jih uporabnik ne izbriše ali zahteva izbris.",
          "Gesel ne hranimo v berljivi obliki. Uporabljamo nadzor dostopa, ločene produkcijske skrivnosti, tehnične dnevnike in druge razumne varnostne ukrepe za zmanjševanje tveganj.",
          "V skladu z GDPR lahko zahtevate dostop do podatkov, popravek, izbris, omejitev obdelave, prenosljivost podatkov, ugovarjate določeni obdelavi ali prekličete privolitev. Zahtevo lahko pošljete na hey@llmvisio.com.",
        ],
      },
      {
        title: "7. Prenosi izven EU/EGP",
        body: [
          "Nekateri ponudniki lahko podatke obdelujejo tudi izven Evropske unije oziroma Evropskega gospodarskega prostora. Kadar pride do takih prenosov, uporabljamo razpoložljive zaščitne mehanizme, kot so standardne pogodbene klavzule, ustrezne pogodbene obveznosti ali drugi veljavni mehanizmi.",
        ],
      },
      {
        title: "8. Cookie policy",
        body: [
          "Uporabljamo nujne piškotke in podobne tehnologije, ki so potrebne za prijavo, varnost, delovanje seje in shranjevanje osnovnih nastavitev, vključno z izbranim jezikom. Teh piškotkov ni mogoče izklopiti brez vpliva na delovanje aplikacije.",
          "Za razumevanje uporabe spletnega mesta in merjenje učinkovitosti oglaševanja lahko uporabljamo analitiko ter oglaševalske oziroma sledilne tehnologije, kot je Meta Pixel, na podlagi vaše privolitve, kjer je ta zahtevana.",
          "Piškotke lahko upravljate tudi v nastavitvah brskalnika. Blokiranje nujnih piškotkov lahko povzroči, da prijava ali aplikacija ne delujeta pravilno.",
        ],
      },
      {
        title: "9. Spremembe politike",
        body: [
          "Politiko zasebnosti lahko občasno posodobimo zaradi sprememb storitve, zakonodaje ali obdelovalcev. Nova različica velja od objave na tej strani.",
        ],
      },
    ],
  },
  en: {
    eyebrow: "Privacy policy",
    title: "Privacy and cookies",
    updatedAt: "July 11, 2026",
    updatedLabel: "Last updated",
    sections: [
      {
        title: "1. Controller and contact",
        body: [
          "The controller for the LLM Visio and AI Visibility Radar service is SEOS group d.o.o. For privacy questions, exercising your rights or unsubscribing from notifications, contact us at hey@llmvisio.com.",
        ],
      },
      {
        title: "2. Data we process",
        body: [
          "When you register, we process your email address, name, hashed password, organization data, plan and email notification settings.",
          "When you use the service, we process brand, domain, competitor and prompt data, scan results, AI answers, citations, recommendations, operation statuses and basic technical logs.",
          "For a free audit, we process email, domain, brand name, selected prompts, competitors and audit results. For contact requests, we process name, email, subject and message content.",
          "For payments, we may process subscription data, payment status and payment-provider identifiers. We do not store full card details in the app.",
        ],
      },
      {
        title: "3. Purposes and legal bases",
        body: [
          "We process data to create and manage accounts, run scans, display results, prepare recommendations, send transactional notifications, provide support, secure the application, bill plans and improve the service.",
          "Legal bases include performance of a contract or pre-contract steps, legitimate interests in security and improvement, compliance with legal obligations and consent for marketing or optional communications.",
          "You can withdraw consent at any time through the unsubscribe link in emails or by contacting hey@llmvisio.com. Withdrawal does not affect processing that happened before it.",
        ],
      },
      {
        title: "4. Email notifications",
        body: [
          "During registration you can separately choose whether to receive marketing emails and whether to receive scan or new-result notifications.",
          "Where appropriate, each email includes a link to manage settings or unsubscribe. Even after unsubscribing, you may still receive necessary service messages for account security, password resets or fulfilling your request.",
        ],
      },
      {
        title: "5. Processors and external providers",
        body: [
          "We use providers for hosting, databases, email delivery, payments, analytics, advertising measurement, automation and AI models. This may include Vercel, Supabase or PostgreSQL infrastructure, Resend, Stripe, Meta or Facebook Pixel, Make.com, OpenAI, Google Gemini and Anthropic Claude.",
          "For AI providers we primarily process prompts, brand data, domains, competitors and publicly available content needed to run the scan. We limit the data sent to what is necessary for the result.",
          "We use contractual and technical measures with processors to protect personal data.",
        ],
      },
      {
        title: "6. Retention, security and rights",
        body: [
          "We keep data for as long as needed to provide the service, support, security, analytics and legal compliance. Account and scan data is generally kept while the account is active or until the user deletes it or requests deletion, unless legal obligations require longer retention.",
          "Passwords are not stored in readable form. We use access controls, separate production secrets, technical logs and other reasonable safeguards to reduce the risk of unauthorized access, loss or misuse.",
          "Under GDPR, you may request access, rectification, erasure, restriction, portability, object to certain processing or withdraw consent. Send requests to hey@llmvisio.com.",
        ],
      },
      {
        title: "7. Transfers outside the EU/EEA",
        body: [
          "Some providers may process data outside the European Union or European Economic Area. Where such transfers occur, we use available safeguards such as standard contractual clauses, appropriate contractual obligations or other valid mechanisms.",
        ],
      },
      {
        title: "8. Cookie policy",
        body: [
          "We use essential cookies and similar technologies required for login, security, session operation and storing basic preferences, including selected language. These cookies cannot be disabled without affecting the app.",
          "We may use analytics and advertising or tracking technologies, such as Meta Pixel, to understand website usage and measure advertising performance, based on consent where required.",
          "You can also manage cookies in browser settings. Blocking essential cookies may cause login or the app to stop working correctly.",
        ],
      },
      {
        title: "9. Changes to this policy",
        body: [
          "We may update this privacy policy from time to time due to service, legal or processor changes. The new version applies from publication on this page.",
        ],
      },
    ],
  },
} as const;

export default async function PrivacyPage() {
  const { locale } = await getI18n();
  const copy = privacyCopy[locale];

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <div className="mb-8">
        <p className="text-sm font-semibold text-primary">{copy.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">
          {copy.title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {copy.updatedLabel}: {copy.updatedAt}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>LLM Visio / AI Visibility Radar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-7">
          {copy.sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              {section.body.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-sm leading-7 text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
