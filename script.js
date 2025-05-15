const GITHUB_BASE = "https://raw.githubusercontent.com/jakobneukirchner/ext_webapp_bsvg/main/";

// Lädt die Dropdowns für Ziel, Via und Sonderansagen
async function loadDropdowns() {
    const zielSelect = document.getElementById("zielSelect");
    const viaSelect = document.getElementById("viaSelect");
    const sonderSelect = document.getElementById("sonderSelect");

    // Leeren Sie die Dropdowns zuerst (außer den Standard-Optionen)
    // Wir lassen die erste Option (index 0) unberührt
    while (zielSelect.options.length > 1) zielSelect.remove(1);
    while (viaSelect.options.length > 1) viaSelect.remove(1);
    while (sonderSelect.options.length > 1) sonderSelect.remove(1);


    // Helper function to fetch and populate
    async function fetchAndPopulate(path, selectElement) {
        try {
            // Verwenden Sie die GitHub API, um die Dateiliste zu erhalten
            const response = await fetch(`https://api.github.com/repos/jakobneukirchner/ext_webapp_bsvg/contents/${path}`);

            if (!response.ok) {
                 // Wenn der Ordner leer ist oder nicht existiert, gibt die API 404 zurück.
                 // Das ist oft kein kritischer Fehler, nur dass keine Optionen verfügbar sind.
                if (response.status === 404) {
                     console.warn(`Ordner auf GitHub nicht gefunden oder leer: ${path}`);
                     // Fügen Sie ggf. eine Option hinzu, die besagt, dass keine Daten gefunden wurden
                     // selectElement.add(new Option(`Fehler: Keine Daten gefunden (${path})`, "error", true, true));
                } else {
                    console.error(`Fehler beim Laden der Daten von ${path}: ${response.status}`);
                    // Fügen Sie eine Fehleroption hinzu
                    // selectElement.add(new Option(`Fehler (${response.status})`, "error", true, true));
                }
                return; // Abbruch bei Fehler oder 404
            }

            const files = await response.json();

            // Filtern Sie nach .mp3 Dateien und fügen Sie sie den Optionen hinzu
            files.forEach(file => {
                if (file.name.endsWith(".mp3")) {
                    // Der Dateiname wird als Text im Dropdown und als Wert verwendet.
                    // Der Wert muss genau dem Dateinamen entsprechen, da er für die URL-Konstruktion genutzt wird.
                    const name = decodeURIComponent(file.name);
                    selectElement.add(new Option(name, name));
                }
            });

            // Wenn keine MP3s gefunden wurden (aber der Ordner existiert), Info hinzufügen
            if (selectElement.options.length <= 1) { // Nur die Standardoption ist vorhanden
                 console.warn(`Keine .mp3 Dateien im Ordner auf GitHub gefunden: ${path}`);
                 // selectElement.add(new Option(`Keine .mp3 Dateien gefunden (${path})`, "no-files", true, true));
            }


        } catch (error) {
            console.error(`Netzwerk- oder Parsing-Fehler beim Laden von ${path}:`, error);
             // Fügen Sie eine Fehleroption hinzu
             // selectElement.add(new Option(`Netzwerkfehler`, "error", true, true));
        }
    }

    // Dropdowns parallel laden
    // Wait for all promises to settle, even if some fail
    await Promise.all([
        fetchAndPopulate("Ziele", zielSelect),
        fetchAndPopulate("via", viaSelect),
        fetchAndPopulate("Hinweise", sonderSelect)
    ]);

    console.log("Dropdowns geladen."); // Zur Fehlerbehebung
}

// Funktion zum Abspielen einer Sequenz von Audiodateien
function playSequence(urls) {
    // Stoppen Sie die Wiedergabe, wenn die Liste leer ist
    if (urls.length === 0) {
        console.log("Audiosequenz beendet.");
        return;
    }

    const currentUrl = urls[0];
    console.log("Spiele ab:", currentUrl); // Zur Fehlerbehebung

    const audio = new Audio(currentUrl);

    // Fehlerbehandlung für das Audio-Element
    audio.onerror = (e) => {
        console.error("Fehler beim Laden oder Abspielen von:", currentUrl, e);
        // Fahren Sie mit dem nächsten Track fort, auch wenn dieser fehlschlägt
        playSequence(urls.slice(1));
    };

    // Starten Sie die Wiedergabe. .play() gibt ein Promise zurück.
    audio.play().then(() => {
        // Erfolg: Wenn das Abspielen gestartet hat, warten Sie bis es endet
        audio.onended = () => {
            console.log("Beendet:", currentUrl);
            playSequence(urls.slice(1)); // Nächsten Track abspielen
        };
    }).catch(error => {
        // Fehler beim Starten der Wiedergabe (z.B. Autoplay blockiert)
        console.error("Fehler beim Starten der Wiedergabe von", currentUrl, ":", error);
        // Auch hier mit dem nächsten Track weitermachen, da dieser eventuell klappt oder wichtig ist
        playSequence(urls.slice(1));
         // Sie könnten hier auch eine Benachrichtigung an den Benutzer anzeigen
    });
}


// Funktion, um die vollständige Ansage abzuspielen
function playAnnouncement() {
    const line = document.getElementById("lineInput").value.trim();
    const ziel = document.getElementById("zielSelect").value;
    const via = document.getElementById("viaSelect").value; // Wert enthält bereits .mp3
    const sonder = document.getElementById("sonderSelect").value; // Wert enthält bereits .mp3

    // Array für die URLs der abzuspielenden Audio-Fragmente
    const urls = [];

    // 1. Linie oder Zug
    if (line) {
        // Linie Nummer XX
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
         // Annahme: Die Zahlendateien sind unter Nummern/line_number_end/XX.mp3 gespeichert
        urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3");
    } else {
        // Zug
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    // 2. Ziel (Ziel ist obligatorisch für eine sinnvolle Ansage)
    if (ziel && ziel !== "") { // Prüfen, ob ein Ziel ausgewählt wurde (nicht der Standard-Leerwert)
        urls.push(GITHUB_BASE + "Fragmente/nach.mp3");
         // Der Via-Wert enthält bereits die .mp3-Endung aus dem Select-Option-Value
        urls.push(GITHUB_BASE + "Ziele/" + encodeURIComponent(ziel));
    } else {
        alert("Bitte wählen Sie ein Fahrziel aus, um die Ansage zu erstellen.");
        console.warn("Ansage abgebrochen: Kein Ziel ausgewählt.");
        return; // Ansage kann ohne Ziel nicht sinnvoll abgespielt werden
    }

    // 3. Via (optional)
    // Prüfen, ob ein Via-Wert ausgewählt wurde (nicht der Standard-Leerwert "")
    // und ob der Wert nicht zufällig "keine.mp3" ist, falls dies als explizite Option existiert
    if (via && via !== "" && via !== "keine.mp3") {
        urls.push(GITHUB_BASE + "Fragmente/über.mp3");
         // Der Via-Wert enthält bereits die .mp3-Endung aus dem Select-Option-Value
        urls.push(GITHUB_BASE + "via/" + encodeURIComponent(via));
    }
    // Wenn via === "" oder via === "keine.mp3", wird dieser Block übersprungen.

    // 4. Sonderansage (optional)
    // Prüfen, ob ein Sonderansage-Wert ausgewählt wurde (nicht der Standard-Leerwert "")
    if (sonder && sonder !== "") {
         // Der Sonder-Wert enthält bereits die .mp3-Endung aus dem Select-Option-Value
         // Die Sonderansage wird direkt an die Sequenz angehängt
        urls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder));
    }

    // Überprüfen Sie das final konstruierte URL-Array (Hilfreich beim Debugging)
    console.log("Konstruierte URLs für die Ansage:", urls);

    // Spielen Sie die gesamte Sequenz ab
    if (urls.length > 0) {
        playSequence(urls);
    } else {
        console.warn("Keine URLs zum Abspielen konstruiert.");
    }
}

// Funktion, um nur die Sonderansage abzuspielen
function playOnlySonderansage() {
    const sonder = document.getElementById("sonderSelect").value;
    // Prüfen, ob Sonderansage ausgewählt wurde (nicht der leere Standard-Value)
    if (sonder && sonder !== "") {
         // Der Sonder-Wert enthält bereits die .mp3-Endung
        const url = GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder);
        console.log("Spiele nur Sonderansage ab:", url);
        playSequence([url]);
    } else {
        alert("Bitte wählen Sie eine Sonderansage aus.");
    }
}

// Funktion, um nur die Via-Ansage abzuspielen
function playOnlyVia() {
    const via = document.getElementById("viaSelect").value;
    // Prüfen, ob via ausgewählt ist und nicht "– Keine Via –" (der leere Standard-Value)
    // und nicht "keine.mp3" ist, falls dies eine explizite Option ist
    if (via && via !== "" && via !== "keine.mp3") {
         // Der Via-Wert enthält bereits die .mp3-Endung
        const viaUrls = [
             GITHUB_BASE + "Fragmente/über.mp3",
             GITHUB_BASE + "via/" + encodeURIComponent(via)
        ];
        console.log("Spiele nur Via ab:", viaUrls);
        playSequence(viaUrls);
    } else {
        alert("Bitte wählen Sie eine gültige Via-Haltestelle aus.");
    }
}

// Event-Listener für die Buttons
document.getElementById("playBtn").addEventListener("click", playAnnouncement);
document.getElementById("sonderBtn").addEventListener("click", playOnlySonderansage);
document.getElementById("viaBtn").addEventListener("click", playOnlyVia);

// Dropdowns laden (Ziele, Via, Sonderansagen) beim Laden der Seite
// Fügen Sie einen Event-Listener hinzu, um sicherzustellen, dass das DOM geladen ist
document.addEventListener("DOMContentLoaded", loadDropdowns);
