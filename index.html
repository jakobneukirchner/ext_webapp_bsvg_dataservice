const GITHUB_BASE = "https://raw.githubusercontent.com/jakobneukirchner/ext_webapp_bsvg/main/";

// Lädt die Dropdowns für Ziel, Via und Sonderansagen
async function loadDropdowns() {
    const zielSelect = document.getElementById("zielSelect");
    const viaSelect = document.getElementById("viaSelect");
    const sonderSelect = document.getElementById("sonderSelect");

    // Helper function to fetch and populate
    async function fetchAndPopulate(path, selectElement) {
        try {
            const response = await fetch(`https://api.github.com/repos/jakobneukirchner/ext_webapp_bsvg/contents/${path}`);
            if (!response.ok) {
                console.error(`Fehler beim Laden der Daten von ${path}: ${response.status}`);
                return;
            }
            const files = await response.json();
            files.forEach(file => {
                if (file.name.endsWith(".mp3")) {
                    const name = decodeURIComponent(file.name);
                    selectElement.add(new Option(name, name));
                }
            });
        } catch (error) {
            console.error(`Netzwerk- oder Parsing-Fehler beim Laden von ${path}:`, error);
        }
    }

    // Ziele laden
    await fetchAndPopulate("Ziele", zielSelect);

    // Via laden
    await fetchAndPopulate("via", viaSelect);

    // Sonderansagen laden
    await fetchAndPopulate("Hinweise", sonderSelect);
}

// Funktion zum Abspielen einer Sequenz von Audiodateien
function playSequence(urls) {
    if (urls.length === 0) {
        return; // Sequenz beendet
    }
    const audio = new Audio(urls[0]);

    // Optional: Fehlerbehandlung für Audio laden/abspielen
    audio.onerror = (e) => {
        console.error("Fehler beim Abspielen von:", urls[0], e);
        // Optional: Versuche, den nächsten Track in der Sequenz zu spielen
        // playSequence(urls.slice(1));
    };

    audio.play().catch(error => {
        // Behandelt Fehler, z.B. Browser-Autoplay-Policy
        console.warn("Automatische Wiedergabe blockiert oder Fehler beim Abspielen:", urls[0], error);
        // Möglicherweise hier eine Benutzerinteraktion anfordern oder Feedback geben
    });


    audio.onended = () => playSequence(urls.slice(1));
}

// Funktion, um die vollständige Ansage abzuspielen
function playAnnouncement() {
    const line = document.getElementById("lineInput").value.trim();
    const ziel = document.getElementById("zielSelect").value;
    const via = document.getElementById("viaSelect").value;
    const sonder = document.getElementById("sonderSelect").value;

    const urls = [];

    // Linie-Nummer einfügen, wenn vorhanden, sonst "Zug"
    if (line) {
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
        urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3");
    } else {
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    // "nach" und Ziel (Ziel ist obligatorisch)
    if (ziel) {
        urls.push(GITHUB_BASE + "Fragmente/nach.mp3");
        urls.push(GITHUB_BASE + "Ziele/" + encodeURIComponent(ziel)); // .mp3 Endung nicht hier hinzufügen, da sie schon im select value ist
    } else {
        alert("Bitte wählen Sie ein Ziel aus.");
        // Wichtig: Wenn kein Ziel ausgewählt, nicht weitermachen!
        return;
    }

    // Überprüfen, ob via ausgewählt ist und nicht "– Keine Via –" (der leere Standard-Value)
    // Annahme: Der leere Wert "" bedeutet "Keine Via" im Select. Der Code nutzte "keine.mp3" vorher,
    // aber der leere Option value im HTML ist "". Wir prüfen auf "".
    if (via && via !== "") {
         // Prüfen, ob der ausgewählte Via-Wert tatsächlich 'keine.mp3' ist, falls das eine explizite Option ist
         // oder ob es der Standard-Leerwert ist.
         // Wenn der Standardwert "" ist und 'keine.mp3' eine echte Option, muss die Logik ggf. angepasst werden.
         // Basierend auf '<option value="">– Keine Via –</option>' ist der Wert für "Keine Via" leer "".
         if (via !== "keine.mp3") { // Überprüfung auf den spezifischen Dateinamen, falls relevant
             urls.push(GITHUB_BASE + "Fragmente/über.mp3");
             urls.push(GITHUB_BASE + "via/" + encodeURIComponent(via)); // .mp3 Endung nicht hier hinzufügen
         }
    }
    // Optional: Wenn via === "keine.mp3" explizit ausgewählt werden kann, passiert hier nichts, was korrekt wäre.


    // Sonderansage (falls angegeben) - wird jetzt einfach zur Liste hinzugefügt
    if (sonder && sonder !== "") { // Prüfen, ob Sonderansage ausgewählt wurde (nicht der leere Standard-Value)
        urls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder)); // .mp3 Endung nicht hier hinzufügen
    }


    // Jetzt die gesamte konstruierte Sequenz abspielen
    playSequence(urls);
}

// Funktion, um nur die Sonderansage abzuspielen
function playOnlySonderansage() {
    const sonder = document.getElementById("sonderSelect").value;
    // Prüfen, ob Sonderansage ausgewählt wurde (nicht der leere Standard-Value)
    if (sonder && sonder !== "") {
        const url = GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder); // .mp3 Endung nicht hier hinzufügen
        playSequence([url]);
    } else {
        alert("Bitte wählen Sie eine Sonderansage aus.");
    }
}

// Funktion, um nur die Via-Ansage abzuspielen
function playOnlyVia() {
    const via = document.getElementById("viaSelect").value;
     // Prüfen, ob via ausgewählt ist und nicht "– Keine Via –" (der leere Standard-Value)
    if (via && via !== "") {
         // Wie in playAnnouncement, prüfen auf 'keine.mp3' falls relevant
         if (via !== "keine.mp3") {
             const viaUrls = [
                 GITHUB_BASE + "Fragmente/über.mp3",
                 GITHUB_BASE + "via/" + encodeURIComponent(via) // .mp3 Endung nicht hier hinzufügen
             ];
             playSequence(viaUrls);
         } else {
             alert("Die ausgewählte Option ist 'Keine Via'.");
         }
    } else {
        alert("Bitte wählen Sie eine Via-Haltestelle aus.");
    }
}

// Event-Listener für die Buttons
document.getElementById("playBtn").addEventListener("click", playAnnouncement);
document.getElementById("sonderBtn").addEventListener("click", playOnlySonderansage);
document.getElementById("viaBtn").addEventListener("click", playOnlyVia);

// Dropdowns laden (Ziele, Via, Sonderansagen) beim Laden der Seite
loadDropdowns();
