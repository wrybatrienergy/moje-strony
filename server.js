
const express = require("express");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const INTERNAL_EMAIL = "test-raport@example.com";

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* =====================================================
   POMOCNICZE
===================================================== */

function clean(value) {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.map(clean).join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value).trim();
}

function escapeHtml(value) {
    return clean(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function emailLayout({ title, subtitle, content, footer }) {
    return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#F3F6FA;font-family:Arial,Helvetica,sans-serif;color:#1F2937;">

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
            style="background:#F3F6FA;padding:35px 12px;">
            <tr>
                <td align="center">

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                        style="max-width:620px;background:#FFFFFF;border-radius:12px;overflow:hidden;">

                        <tr>
                            <td style="background:#0B1F3A;padding:30px 35px;">
                                <div style="font-size:25px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">
                                    Energia50001.pl
                                </div>
                                <div style="font-size:11px;color:#BBF7D0;letter-spacing:2px;margin-top:8px;">
                                    ANALIZA ENERGETYCZNA PRZEDSIĘBIORSTW
                                </div>
                            </td>
                        </tr>

                        <tr>
                            <td style="padding:35px;">

                                <div style="font-size:11px;font-weight:700;color:#16A34A;letter-spacing:1.5px;margin-bottom:12px;">
                                    ${subtitle}
                                </div>

                                <h1 style="font-size:24px;line-height:1.35;color:#0B1F3A;margin:0 0 22px;">
                                    ${title}
                                </h1>

                                ${content}

                            </td>
                        </tr>

                        <tr>
                            <td style="background:#F8FAFC;border-top:1px solid #E5E7EB;padding:25px 35px;">

                                <div style="font-size:13px;color:#475569;line-height:1.7;">
                                    ${footer}
                                </div>

                                <div style="font-size:11px;color:#94A3B8;margin-top:18px;">
                                    Energia50001.pl | Wstępna analiza energetyczna
                                </div>

                            </td>
                        </tr>

                    </table>

                </td>
            </tr>
        </table>

    </body>
    </html>
    `;
}

function emailDataTable(rows) {
    return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
        style="border-collapse:collapse;margin:12px 0 25px;">
        ${rows.map(([label, value]) => `
            <tr>
                <td style="padding:11px 10px;border-bottom:1px solid #E5E7EB;width:40%;font-size:13px;color:#64748B;vertical-align:top;">
                    ${escapeHtml(label)}
                </td>
                <td style="padding:11px 10px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#0B1F3A;font-weight:600;vertical-align:top;white-space:pre-wrap;word-break:break-word;">
                    ${escapeHtml(value || "Nie podano")}
                </td>
            </tr>
        `).join("")}
    </table>
    `;
}

function emailSection(title, rows) {
    return `
        <h2 style="font-size:16px;color:#0B1F3A;margin:28px 0 8px;padding-bottom:10px;border-bottom:2px solid #22C55E;">
            ${escapeHtml(title)}
        </h2>
        ${emailDataTable(rows)}
    `;
}


function addSection(doc, title) {
    doc.moveDown(0.8);
    doc.font("DejaVu")
        .fontSize(14)
        .fillColor("#1E3A8A")
        .text(title);

    doc.moveDown(0.3);
    doc.font("DejaVu")
        .fontSize(10)
        .fillColor("#333333");
}

function addField(doc, label, value) {
    const text = clean(value);

    doc.font("DejaVu")
        .fontSize(10)
        .fillColor("#0B1F3A")
        .text(label + ": ", { continued: true });

    doc.font("DejaVu")
        .fillColor("#333333")
        .text(text || "Nie podano", {
            width: 480
        });
}

function createPDF(data, includeContact = false) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: "A4",
            margins: {
                top: 45,
                bottom: 45,
                left: 50,
                right: 50
            },
            bufferPages: true
        });

doc.registerFont(
  "DejaVu",
  path.join(__dirname, "public", "fonts", "DejaVuSans.ttf")
);
        const chunks = [];

        doc.on("data", chunk => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        /* NAGŁÓWEK */

        doc.font("DejaVu")
            .fontSize(22)
            .fillColor("#0B1F3A")
            .text("ENERGIA50001.PL");

        doc.moveDown(0.3);

        doc.font("DejaVu")
            .fontSize(16)
            .fillColor("#1E3A8A")
            .text("Raport analizy energetycznej");

        doc.moveDown(0.4);

        doc.fontSize(9)
            .fillColor("#666666")
            .text("Wstępna analiza danych przedsiębiorstwa");

        doc.moveDown();

        /* DANE PRZEDSIĘBIORSTWA */

        addSection(doc, "1. Dane przedsiębiorstwa");

        addField(doc, "Nazwa przedsiębiorstwa", data.companyName);
        addField(doc, "NIP", data.nip);
        addField(doc, "REGON", data.regon);
        addField(doc, "Status VAT", data.vatStatus);
        addField(doc, "Adres przedsiębiorstwa", data.companyAddress);

        /* DANE KONTAKTOWE - TYLKO PDF WEWNĘTRZNY */

        if (includeContact) {
            addSection(doc, "Dane osoby kontaktowej");

            addField(doc, "Imię i nazwisko", data.contactName);
            addField(doc, "Adres e-mail", data.contactEmail);
            addField(doc, "Telefon", data.contactPhone);
        }

        /* BILANS ENERGII */

        addSection(doc, "2. Bilans energetyczny");

        addField(doc, "Średnie zużycie energii", data.averageTJ + " TJ");
        addField(doc, "Średnie zużycie energii", data.averageGWh + " GWh");
        addField(doc, "Liczba uzupełnionych lat", data.completedYears);

        doc.moveDown(0.5);

        doc.font("DejaVu")
            .fontSize(10)
            .fillColor("#0B1F3A")
            .text("Roczne zużycie energii");

        doc.moveDown(0.3);

        const yearlyResults = Array.isArray(data.yearlyResults)
            ? data.yearlyResults
            : [];

        yearlyResults.forEach(item => {
            addField(
                doc,
                String(item.year),
                `${clean(item.gj)} GJ | ${clean(item.gwh)} GWh`
            );
        });

        /* INFORMACJE O PRZEDSIĘBIORSTWIE */

        addSection(doc, "3. Charakterystyka przedsiębiorstwa");

        addField(doc, "Liczba pracowników", data.employees);
        addField(doc, "Liczba lokalizacji", data.locations);
        addField(doc, "Profil działalności", data.companyProfile);
        addField(doc, "Procesy realizowane w firmie", data.processes);
        addField(doc, "Energochłonność procesów", data.processEnergy);

        /* BUDYNKI */

        addSection(doc, "4. Budynki i powierzchnia");

        addField(doc, "Budynki biurowe", data.officeBuildings);
        addField(doc, "Budynki przemysłowe", data.industrialBuildings);
        addField(doc, "Powierzchnia budynków", data.buildingArea);

        /* INSTALACJE */

        addSection(doc, "5. Instalacje i infrastruktura");

        addField(doc, "Ogrzewanie", data.heating);
        addField(doc, "Wentylacja", data.ventilation);
        addField(doc, "Posiadane instalacje", data.installations);
        addField(doc, "Szczegóły instalacji", data.installDetails);

        /* MODERNIZACJE */

        addSection(doc, "6. Modernizacje energetyczne");

        addField(doc, "Przeprowadzone modernizacje", data.modernizations);

        /* DOKUMENTACJA */

        addSection(doc, "7. Dostępna dokumentacja");

        addField(doc, "Posiadane dokumenty", data.documents);

        /* ZAKRES AUDYTU */

        addSection(doc, "8. Zakres analizy");

        addField(doc, "Oczekiwany zakres audytu", data.auditScope);

        /* INFORMACJE DODATKOWE */

        addSection(doc, "9. Informacje dodatkowe");

        addField(doc, "Dodatkowe informacje", data.additionalInfo);

        /* INFORMACJA KOŃCOWA */

        doc.moveDown(1.5);

        doc.font("DejaVu")
            .fontSize(10)
            .fillColor("#B45309")
            .text("Ważna informacja");

        doc.moveDown(0.3);

        doc.font("DejaVu")
            .fontSize(9)
            .fillColor("#555555")
            .text(
                "Niniejszy raport stanowi wstępne zestawienie danych " +
                "przekazanych przez użytkownika kalkulatora Energia50001.pl. " +
                "Wynik ma charakter informacyjny i nie stanowi opinii prawnej, " +
                "audytu energetycznego ani ostatecznej kwalifikacji " +
                "przedsiębiorstwa do obowiązków wynikających z przepisów. " +
                "Ostateczna ocena wymaga weryfikacji danych i aktualnych " +
                "wymagań prawnych.",
                {
                    align: "justify",
                    lineGap: 3
                }
            );

        /* STOPKA NA KAŻDEJ STRONIE */

        const range = doc.bufferedPageRange();

        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);

            doc.font("DejaVu")
                .fontSize(8)
                .fillColor("#888888")
                .text(
                    "Energia50001.pl | Raport analizy energetycznej",
                    50,
                    doc.page.height - 30,
                    {
                        width: 495,
                        align: "center"
                    }
                );
        }

        doc.end();
    });
}

/* =====================================================
   KONFIGURACJA POCZTY
===================================================== */

let transporter;
let emailPreviewMode = false;

async function configureMailer() {
    if (
        process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS
    ) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        await transporter.verify();

        console.log("Połączenie SMTP zostało skonfigurowane.");
    } else {
        const testAccount = await nodemailer.createTestAccount();

        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });

        emailPreviewMode = true;

        console.log("Uruchomiono testową pocztę Ethereal.");
        console.log("Konto testowe:", testAccount.user);
    }
}

/* =====================================================
   WERYFIKACJA NIP W API MINISTERSTWA FINANSÓW
===================================================== */

function validateNip(nip) {
    if (!/^\d{10}$/.test(nip)) return false;

    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];

    const sum = weights.reduce(
        (total, weight, index) =>
            total + weight * Number(nip[index]),
        0
    );

    return sum % 11 === Number(nip[9]);
}

app.get("/api/company/:nip", async (req, res) => {
    try {
        const nip = String(req.params.nip).replace(/\D/g, "");

        if (!validateNip(nip)) {
            return res.status(400).json({
                error: "Nieprawidłowy numer NIP."
            });
        }

        const date = new Date().toISOString().slice(0, 10);

        const url =
            `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${date}`;

        const response = await fetch(url);

        const result = await response.json();

        if (!response.ok || !result.result || !result.result.subject) {
            return res.status(404).json({
                error: "Nie znaleziono firmy w wykazie Ministerstwa Finansów."
            });
        }

        const subject = result.result.subject;

        return res.json({
            name: subject.name || "",
            regon: subject.regon || "",
            vatStatus: subject.statusVat || "Brak informacji",
            residenceAddress: subject.residenceAddress || "",
            workingAddress: subject.workingAddress || ""
        });

    } catch (error) {
        console.error("Błąd weryfikacji NIP:", error);

        return res.status(500).json({
            error: "Nie udało się pobrać danych firmy."
        });
    }
});

/* =====================================================
   WYSYŁKA RAPORTÓW PDF
===================================================== */

app.post("/api/send-report", async (req, res) => {
    try {
        const data = req.body || {};

        /* WALIDACJA DANYCH */

        if (!clean(data.contactName)) {
            return res.status(400).json({
                error: "Podaj imię i nazwisko."
            });
        }

        if (!clean(data.contactEmail)) {
            return res.status(400).json({
                error: "Podaj adres e-mail."
            });
        }

        const email = clean(data.contactEmail);

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                error: "Podaj prawidłowy adres e-mail."
            });
        }

        if (!clean(data.contactPhone)) {
            return res.status(400).json({
                error: "Podaj numer telefonu."
            });
        }

        if (data.privacyAccepted !== true) {
            return res.status(400).json({
                error: "Wymagana jest akceptacja polityki prywatności."
            });
        }

        if (!clean(data.companyName)) {
            return res.status(400).json({
                error: "Brakuje nazwy przedsiębiorstwa."
            });
        }

        if (!Array.isArray(data.yearlyResults)) {
            return res.status(400).json({
                error: "Brakuje wyników rocznego zużycia energii."
            });
        }

        /* DWA ODRĘBNE PLIKI PDF */

        const clientPDF = await createPDF(data, false);
        const internalPDF = await createPDF(data, true);

     
/* =====================================================
   WIADOMOŚĆ DLA KLIENTA
===================================================== */

const clientMail = {
    from: process.env.MAIL_FROM || '"Energia50001.pl" <kontakt@energia50001.pl>',
    to: email,

    subject: "Raport analizy energetycznej – Energia50001.pl",

    text:
        "Dzień dobry,\n\n" +
        "Dziękujemy za skorzystanie z kalkulatora Energia50001.pl.\n\n" +
        "W załączniku przesyłamy raport przygotowany na podstawie " +
        "informacji przekazanych w formularzu.\n\n" +
        "W razie pytań zapraszamy do kontaktu.\n\n" +
        "Zespół Energia50001.pl",

    html: emailLayout({
        subtitle: "TWÓJ RAPORT JEST GOTOWY",

        title: "Dziękujemy za skorzystanie z naszego kalkulatora!",

        content: `
            <p style="font-size:15px;line-height:1.8;color:#475569;margin:0 0 18px;">
                Dzień dobry,
            </p>

            <p style="font-size:15px;line-height:1.8;color:#475569;margin:0 0 20px;">
                Dziękujemy za przesłanie danych przedsiębiorstwa
                za pośrednictwem kalkulatora Energia50001.pl.
            </p>

            <p style="font-size:15px;line-height:1.8;color:#475569;margin:0 0 25px;">
                Na podstawie przekazanych informacji przygotowaliśmy
                raport zawierający zestawienie danych dotyczących
                zużycia energii oraz charakterystyki przedsiębiorstwa.
            </p>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                style="background:#F1F5F9;border-radius:10px;margin:25px 0;">
                <tr>
                    <td style="padding:22px;">
                        <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                                <td style="font-size:28px;color:#DC2626;padding-right:14px;vertical-align:middle;">
                                    PDF
                                </td>
                                <td style="vertical-align:middle;">
                                    <div style="font-size:15px;font-weight:700;color:#0B1F3A;">
                                        Raport analizy energetycznej
                                    </div>
                                    <div style="font-size:12px;color:#64748B;margin-top:5px;">
                                        Dokument PDF znajduje się w załączniku.
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <p style="font-size:14px;line-height:1.8;color:#64748B;margin:20px 0;">
                Raport stanowi wstępne zestawienie przekazanych danych.
                Ostateczna ocena wymaga ich weryfikacji.
            </p>

            <p style="font-size:14px;line-height:1.8;color:#475569;margin-top:25px;">
                W przypadku pytań lub potrzeby uzyskania dodatkowych
                informacji zapraszamy do kontaktu.
            </p>

            <p style="font-size:14px;color:#0B1F3A;font-weight:700;margin-top:25px;">
                Dziękujemy za zaufanie!
            </p>
        `,

        footer: `
            Pozdrawiamy,<br>
            <strong style="color:#0B1F3A;">Zespół Energia50001.pl</strong><br>
            <a href="mailto:kontakt@energia50001.pl"
                style="color:#1E3A8A;text-decoration:none;">
                kontakt@energia50001.pl
            </a>
        `
    }),

    attachments: [
        {
            filename: "raport-energetyczny.pdf",
            content: clientPDF,
            contentType: "application/pdf"
        }
    ]
};


/* =====================================================
   WIADOMOŚĆ WEWNĘTRZNA DLA SZEFOSTWA
===================================================== */

const yearlyRows = data.yearlyResults.map(item => [
    String(item.year),
    `${clean(item.gj)} GJ | ${clean(item.gwh)} GWh`
]);

const internalMail = {
    from: process.env.MAIL_FROM || '"Energia50001.pl" <kontakt@energia50001.pl>',

    to: INTERNAL_EMAIL,
    replyTo: email,

    subject:
        "Nowe zgłoszenie – " + clean(data.companyName),

    text:
        "Nowe zgłoszenie z kalkulatora Energia50001.pl.\n\n" +
        "Firma: " + clean(data.companyName) + "\n" +
        "Osoba kontaktowa: " + clean(data.contactName) + "\n" +
        "E-mail: " + email + "\n" +
        "Telefon: " + clean(data.contactPhone) + "\n" +
        "Średnie zużycie: " + clean(data.averageTJ) + " TJ\n\n" +
        "Szczegółowe dane znajdują się w wiadomości HTML i załączonym PDF.",

    html: emailLayout({
        subtitle: "POWIADOMIENIE WEWNĘTRZNE",

        title: "Otrzymano nowe zgłoszenie z kalkulatora",

        content: `
            <div style="background:#ECFDF5;border-left:4px solid #22C55E;padding:15px 18px;margin-bottom:25px;border-radius:5px;">
                <div style="font-size:14px;font-weight:700;color:#166534;">
                    Nowa analiza energetyczna
                </div>
                <div style="font-size:13px;color:#475569;margin-top:5px;">
                    Przedsiębiorstwo: ${escapeHtml(data.companyName)}
                </div>
            </div>

            ${emailSection("1. Dane osoby kontaktowej", [
                ["Imię i nazwisko", data.contactName],
                ["Adres e-mail", data.contactEmail],
                ["Numer telefonu", data.contactPhone]
            ])}

            ${emailSection("2. Dane przedsiębiorstwa", [
                ["Nazwa przedsiębiorstwa", data.companyName],
                ["NIP", data.nip],
                ["REGON", data.regon],
                ["Status VAT", data.vatStatus],
                ["Adres przedsiębiorstwa", data.companyAddress],
                ["Liczba pracowników", data.employees],
                ["Liczba lokalizacji", data.locations]
            ])}

            ${emailSection("3. Bilans energetyczny", [
                ["Średnie zużycie energii", `${clean(data.averageTJ)} TJ`],
                ["Odpowiednik energetyczny", `${clean(data.averageGWh)} GWh`],
                ["Liczba uzupełnionych lat", data.completedYears]
            ])}

            ${emailSection("4. Roczne zużycie energii", yearlyRows)}

            ${emailSection("5. Charakterystyka przedsiębiorstwa", [
                ["Profil działalności", data.companyProfile],
                ["Główne procesy technologiczne", data.processes],
                ["Energia wykorzystywana w procesach", data.processEnergy]
            ])}

            ${emailSection("6. Budynki i powierzchnia", [
                ["Budynki biurowe", data.officeBuildings],
                ["Hale przemysłowe i magazynowe", data.industrialBuildings],
                ["Powierzchnia budynków", data.buildingArea]
            ])}

            ${emailSection("7. Instalacje i infrastruktura", [
                ["Ogrzewanie", data.heating],
                ["Wentylacja i klimatyzacja", data.ventilation],
                ["Posiadane instalacje", data.installations],
                ["Szczegóły instalacji", data.installDetails]
            ])}

            ${emailSection("8. Modernizacje energetyczne", [
                ["Przeprowadzone modernizacje", data.modernizations]
            ])}

            ${emailSection("9. Dostępna dokumentacja", [
                ["Posiadane dokumenty", data.documents]
            ])}

            ${emailSection("10. Zakres analizy", [
                ["Oczekiwany zakres audytu", data.auditScope]
            ])}

            ${emailSection("11. Informacje dodatkowe", [
                ["Dodatkowe informacje", data.additionalInfo]
            ])}

            <div style="background:#EFF6FF;border-left:4px solid #1E3A8A;padding:16px 18px;margin-top:25px;border-radius:5px;">
                <div style="font-size:14px;font-weight:700;color:#0B1F3A;">
                    Raport wewnętrzny PDF
                </div>
                <div style="font-size:13px;color:#475569;margin-top:6px;">
                    Pełny dokument z danymi kontaktowymi klienta
                    został dołączony do tej wiadomości.
                </div>
            </div>
        `,

        footer: `
            Wiadomość wygenerowana automatycznie przez kalkulator
            <strong style="color:#0B1F3A;">Energia50001.pl</strong>.<br>
            Adres klienta do odpowiedzi: ${escapeHtml(email)}
        `
    }),

    attachments: [
        {
            filename: "raport-energetyczny-wewnetrzny.pdf",
            content: internalPDF,
            contentType: "application/pdf"
        }
    ]
};

        
/* WYSYŁKA OBU WIADOMOŚCI */

const results = await Promise.allSettled([
    transporter.sendMail(clientMail),
    transporter.sendMail(internalMail)
]);

const labels = [
    "WIADOMOŚĆ KLIENCKA",
    "WIADOMOŚĆ WEWNĘTRZNA"
];

let failed = false;

results.forEach((result, index) => {
    console.log(`\n--- ${labels[index]} ---`);

    if (result.status === "fulfilled") {
        console.log("WYSŁANO");

        console.log("Message ID:", result.value.messageId);

        if (emailPreviewMode) {
            console.log(
                "Podgląd:",
                nodemailer.getTestMessageUrl(result.value)
            );
        }
    } else {
        failed = true;
        console.error("BŁĄD WYSYŁKI:", result.reason);
    }
});

if (failed) {
    return res.status(500).json({
        error: "Nie udało się wysłać obu wiadomości. Sprawdź logi serwera."
    });
}

return res.json({
    success: true,
    message: emailPreviewMode
        ? "Obie wiadomości przygotowano w Ethereal."
        : "Obie wiadomości zostały wysłane."
});


    } catch (error) {
        console.error("Błąd wysyłania raportu:", error);

        return res.status(500).json({
            error: "Nie udało się wysłać raportu. Spróbuj ponownie później."
        });
    }
});

/* =====================================================
   URUCHOMIENIE SERWERA
===================================================== */

async function startServer() {
    try {
        await configureMailer();

        app.listen(PORT, () => {
            console.log(`Serwer działa na porcie ${PORT}`);
        });
    } catch (error) {
        console.error("Nie udało się uruchomić serwera:", error);
        process.exit(1);
    }
}

startServer();
