import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const updatedAt = "7. julij 2026";

const sections = [
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
      "Pri brezplačnem auditu obdelujemo e-mail, domeno, ime znamke, izbrane prompte, konkurente in rezultat audita.",
      "Pri kontaktu obdelujemo ime, e-mail, zadevo in vsebino sporočila.",
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
      "Vsak e-mail, kjer je to primerno, vsebuje povezavo za upravljanje nastavitev ali odjavo. Tudi po odjavi lahko še vedno prejmemo ali pošljemo nujna servisna sporočila, kadar so potrebna za varnost računa, ponastavitev gesla ali izpolnitev vaše zahteve.",
    ],
  },
  {
    title: "5. Obdelovalci in zunanji ponudniki",
    body: [
      "Za delovanje storitve uporabljamo ponudnike gostovanja, baze podatkov, e-mail pošiljanja, plačil, analitike, avtomatizacij in AI modelov. To lahko vključuje Vercel, Supabase oziroma PostgreSQL infrastrukturo, Resend, Stripe, Make.com, OpenAI, Google Gemini in Anthropic Claude.",
      "Pri AI ponudnikih obdelujemo predvsem prompte, podatke o znamki, domeni, konkurentih in javno dostopne vsebine, potrebne za izvedbo scana. Obseg poslanih podatkov omejujemo na tisto, kar je potrebno za rezultat.",
      "Z obdelovalci uporabljamo pogodbene in tehnične ukrepe, ki so namenjeni varovanju osebnih podatkov.",
    ],
  },
  {
    title: "6. Hramba podatkov",
    body: [
      "Podatke hranimo toliko časa, kot je potrebno za izvajanje storitve, podporo, varnost, analitiko in izpolnjevanje zakonskih obveznosti. Podatke računa in scanov praviloma hranimo, dokler je račun aktiven oziroma dokler jih uporabnik ne izbriše ali zahteva izbris, razen kadar moramo nekatere podatke hraniti zaradi zakonitih obveznosti ali reševanja zahtevkov.",
      "Kontaktna sporočila hranimo toliko časa, kot je potrebno za obravnavo vprašanja. E-mail dogodke hranimo za diagnostiko dostave, preprečevanje zlorab in dokazovanje nastavitev obveščanja.",
    ],
  },
  {
    title: "7. Varnost",
    body: [
      "Gesel ne hranimo v berljivi obliki. Uporabljamo nadzor dostopa, ločene produkcijske skrivnosti, tehnične dnevnike in druge razumne varnostne ukrepe za zmanjševanje tveganj nepooblaščenega dostopa, izgube ali zlorabe podatkov.",
      "Kljub temu noben informacijski sistem ni popolnoma brez tveganja. Če zaznamo varnostni incident, ravnamo v skladu z veljavno zakonodajo.",
    ],
  },
  {
    title: "8. Pravice posameznikov",
    body: [
      "V skladu z GDPR lahko zahtevate dostop do podatkov, popravek, izbris, omejitev obdelave, prenosljivost podatkov, ugovarjate določeni obdelavi ali prekličete privolitev.",
      "Zahtevo lahko pošljete na hey@llmvisio.com. Če menite, da vaših podatkov ne obdelujemo zakonito, imate pravico vložiti pritožbo pri Informacijskem pooblaščencu Republike Slovenije ali drugem pristojnem nadzornem organu v EU.",
    ],
  },
  {
    title: "9. Prenosi izven EU/EGP",
    body: [
      "Nekateri ponudniki lahko podatke obdelujejo tudi izven Evropske unije oziroma Evropskega gospodarskega prostora. Kadar pride do takih prenosov, uporabljamo razpoložljive zaščitne mehanizme, kot so standardne pogodbene klavzule, ustrezne pogodbene obveznosti ali drugi veljavni mehanizmi.",
    ],
  },
  {
    title: "10. Cookie policy",
    body: [
      "Uporabljamo nujne piškotke in podobne tehnologije, ki so potrebne za prijavo, varnost, delovanje seje in shranjevanje osnovnih nastavitev. Teh piškotkov ni mogoče izklopiti brez vpliva na delovanje aplikacije.",
      "Za razumevanje uporabe spletnega mesta lahko uporabljamo zasebnosti prijazno agregirano analitiko. Če bi v prihodnje uvedli neobvezne analitične, oglaševalske ali sledilne piškotke, jih bomo uporabljali na podlagi vaše privolitve, kjer je ta zahtevana.",
      "Piškotke lahko upravljate tudi v nastavitvah brskalnika. Blokiranje nujnih piškotkov lahko povzroči, da prijava ali aplikacija ne delujeta pravilno.",
    ],
  },
  {
    title: "11. Spremembe politike",
    body: [
      "Politiko zasebnosti lahko občasno posodobimo zaradi sprememb storitve, zakonodaje ali obdelovalcev. Nova različica velja od objave na tej strani.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <div className="mb-8">
        <p className="text-sm font-semibold text-primary">
          Politika zasebnosti
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">
          Zasebnost in piškotki
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Zadnja posodobitev: {updatedAt}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>LLM Visio / AI Visibility Radar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-7">
          {sections.map((section) => (
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
