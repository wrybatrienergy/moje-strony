const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.static("public"));

app.get("/api/company/:nip", async (req, res) => {

    const nip = req.params.nip;

    try {

        const today = new Date()
            .toISOString()
            .split("T")[0];

        const url =
            `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${today}`;

        const response = await axios.get(url);

        const company =
            response.data.result.subject;

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});
