
const express = require("express");
const axios = require("axios");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

const app = express();

app.use(express.static("public"));
app.use(express.json({ limit: "2mb" }));

// Weryfikacja NIP w bazie Ministerstwa Finansów
app.get("/api/company/:nip", async (req, res) => {
    const nip = req.params.nip;

    try {
        const today = new Date().toISOString().split("T")[0];

        const url =
            `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${today}`;

        const response = await axios.get(url);
        const company = response.data.result.subject;

        if (!company) {
            return res.status(404).json({
                error: "Firma nie została znaleziona"
            });
        }

        res.json({
            nip: company.nip,
            name: company.name,
            regon: company.regon,
            vatStatus: company.statusVat,
            residenceAddress: company.residenceAddress,
            workingAddress: company.workingAddress
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: "Błąd pobierania danych firmy"
        });
    }
});

// Konfiguracja poczty
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Generowanie PDF
function generatePDF(data) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: "A4",
            margins: {
                top: 50,
                bottom: 50,
                left: 50,
                right: 50
            }
        });

        const chunks = [];

        doc.on("data", chunk => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        // Czcionka obsługująca polskie znaki
        // Plik umieść w folderze public/fonts
        doc.font("public/fonts/DejaVuSans.ttf");

        doc.fontSize(20)
            .fillColor("#0B1F3A")
            .text("RAPORT ANALIZY ENERGETYCZNEJ", {
                align: "center"
            });

        doc.moveDown();

        doc.fontSize(11).fillColor("#333333");

        doc.text(`Firma: ${data.companyName || ""}`);
        doc.text(`NIP: ${data.nip || ""}`);
        doc.text(`REGON: ${data.regon || ""}`);
        doc.text(`Status VAT: ${data.vatStatus || ""}`);
        doc.text(`Adres: ${data.companyAddress || ""}`);

        doc.moveDown();

        doc.fontSize(15).fillColor("#1E3A8A")
            .text("Bilans energetyczny");

        doc.fontSize(11).fillColor("#333333");

        doc.text(`Średnie zużycie: ${data.averageTJ || ""} TJ`);
        doc.text(`Odpowiednik: ${data.averageGWh || ""} GWh`);
        doc.text(`Uzupełnione lata: ${data.completedYears || ""}/3`);

        doc.moveDown();

        doc.fontSize(13).fillColor("#1E3A8A")
            .text("Zużycie energii w poszczególnych latach");

        doc.moveDown(0.5);

        (data.yearlyResults || []).forEach(item => {
            doc.fontSize(11).fillColor("#333333")
                .text(`${item.year}: ${item.gj} GJ | ${item.gwh} GWh`);
        });

        doc.moveDown();

        doc.fontSize(15).fillColor("#1E3A8A")
            .text("Informacje o przedsiębiorstwie");

        doc.fontSize(11).fillColor("#333333");

        const fields = [
            ["Pracownicy", data.employees],
            ["Lokalizacje", data.locations],
            ["Profil działalności", data.companyProfile],
            ["Procesy technologiczne", data.processes],
            ["Energia w procesach", data.processEnergy],
            ["Powierzchnia budynków", data.buildingArea],
            ["Ogrzewanie", data.heating],
            ["Wentylacja", data.ventilation],
            ["Instalacje", data.installations],
            ["Modernizacje", data.modernizations],
            ["Dokumentacja", data.documents],
            ["Zakres audytu", data.auditScope],
            ["Dodatkowe informacje", data.additionalInfo]
        ];

        fields.forEach(([label, value]) => {
            doc.moveDown(0.3);
            doc.text(`${label}: ${value || "Nie podano"}`);
        });

        doc.moveDown();

        doc.fontSize(9).fillColor("#666666")
            .text(
                "Raport stanowi wstępne zestawienie danych przekazanych przez użytkownika. Nie jest opinią prawną ani ostateczną kwalifikacją obowiązków przedsiębiorstwa."
            );

        doc.end();
    });
}

// Odbiór danych i wysyłka raportu do zespołu
app.post("/api/send-report", async (req, res) => {
    try {
        const data = req.body;

        if (
            !data.contactName ||
            !data.contactEmail ||
            !data.contactPhone ||
            data.privacyAccepted !== true
        ) {
            return res.status(400).json({
                error: "Uzupełnij dane kontaktowe i zaakceptuj politykę prywatności."
            });
        }

        if (
            typeof data.contactEmail !== "string" ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)
        ) {
            return res.status(400).json({
                error: "Nieprawidłowy adres e-mail."
            });
        }

        const pdf = await generatePDF(data);

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: "wryba@trienergy.com.pl",
            subject: `Nowa analiza energetyczna – ${data.companyName || "Firma"}`,
            text:
                `Nowe zgłoszenie analizy energetycznej.\n\n` +
                `Firma: ${data.companyName || ""}\n` +
                `Kontakt: ${data.contactName}\n` +
                `E-mail klienta: ${data.contactEmail}\n` +
                `Telefon: ${data.contactPhone}\n\n` +
                `Raport PDF znajduje się w załączniku.`,
            attachments: [{
                filename: "raport-energetyczny.pdf",
                content: pdf
            }]
        });

        res.json({
            success: true,
            message: "Analiza została przekazana do zespołu."
        });

    } catch (error) {
        console.error("Błąd wysyłki raportu:", error);

        res.status(500).json({
            error: "Nie udało się wysłać raportu. Spróbuj ponownie."
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});
