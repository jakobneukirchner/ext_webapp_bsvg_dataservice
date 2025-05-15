const GITHUB_BASE = "https://raw.githubusercontent.com/jakobneukirchner/ext_webapp_bsvg/main/";

// Globale Variablen zur Steuerung der Wiedergabe
let currentAudio = null; // Aktuelles Audio-Element
let audioUrls = []; // Die Liste der URLs, die abgespielt werden sollen
let currentIndex = 0; // Der Index des aktuell abzuspielenden Titels im audioUrls-Array

// Stoppt die aktuelle Wiedergabe
function stopPlayback() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null; // Audio-Element freigeben
    }
    audioUrls = []; // Liste leeren
    currentIndex = 0; // Index zurücksetzen
    console.log("Wiedergabe gestoppt.");
}

// Startet eine neue Wiedergabesequenz
function startPlayback(urls) {
    stopPlayback(); // Stoppen Sie zuerst jede laufende Wiedergabe
    audioUrls = urls;
    currentIndex = 0;
    playNextAudio(); // Starten Sie den ersten Titel
}

// Spielt den nächsten Titel in der Sequenz ab
function playNextAudio() {
    // Wenn der Index außerhalb des Arrays liegt, ist die Sequenz beendet
    if (currentIndex >= audioUrls.length) {
        console.log("Audiosequenz vollständig beendet.");
        currentAudio = null; // Aufräumen
        return;
    }

    const url = audioUrls[currentIndex];
    console.log(`Versuche abzuspielen [${currentIndex + 1}/${audioUrls.length}]:`, url); // Debugging-Ausgabe

    currentAudio = new Audio(url);

    // Fehlerbehandlung: Wenn ein Titel nicht geladen oder abgespielt werden kann
    currentAudio.onerror = (e) => {
        console.error(`Fehler beim Laden oder Abspielen von ${url}:`, e);
        currentIndex++; // Springe zum nächsten Titel
        playNextAudio(); // Versuche den nächsten Titel
    };

    // Event-Listener für das Ende des aktuellen Titels
    currentAudio.onended = () => {
        console.log(`Beendet: ${url}`);
        currentIndex++; // Springe zum nächsten Titel
        playNextAudio(); // Versuche den nächsten Titel
    };

    // Starten Sie die Wiedergabe. .play() gibt ein Promise zurück, um Autoplay-Probleme zu erkennen.
    currentAudio.play().then(() => {
        // Wiedergabe erfolgreich gestartet
        console.log(`Wiedergabe gestartet: ${url}`);
    }).catch(error => {
        // Fehler beim Starten der Wiedergabe (z.B. Browser blockiert Autoplay ohne Benutzerinteraktion)
        console.error(`Fehler beim Starten der Wiedergabe von ${url}:`, error);
        // Auch hier springen wir zum nächsten Titel, damit die Sequenz weiterläuft,
        // falls nur dieser spezifische Titel ein Problem hat oder der Browser am Anfang blockiert hat.
        currentIndex++;
        playNextAudio();
         // Hier könnten Sie eine Meldung an den Benutzer anzeigen, dass Wiedergabe blockiert wurde.
    });
}


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
            const response = await fetch(`https://api.github.com/repos/jakobneukirchner/ext_webapp_bsvg/contents/${path}`);

            if (!response.ok) {
                 console.warn(`Konnte Daten für ${path} nicht laden (Status: ${response.status}).`);
                return;
            }

            const files = await response.json();

            files.forEach(file => {
                if (file.name.endsWith(".mp3")) {
                    const name = decodeURIComponent(file.name);
                    // Der Dateiname mit Endung wird als Text und Wert gespeichert.
                    selectElement.add(new Option(name, name));
                }
            });

             if (selectElement.options.length <= 1) {
                 console.warn(`Keine .mp3 Dateien im Ordner ${path} gefunden.`);
             }

        } catch (error) {
            console.error(`Netzwerkfehler beim Laden von ${path}:`, error);
        }
    }

    // Dropdowns parallel laden
    await Promise.all([
        fetchAndPopulate("Ziele", zielSelect),
        fetchAndPopulate("via", viaSelect),
        fetchAndPopulate("Hinweise", sonderSelect)
    ]);

    console.log("Dropdowns geladen.");
}


// Funktion, um die vollständige Ansage abzuspielen
function playAnnouncement() {
    const line = document.getElementById("lineInput").value.trim();
    const ziel = document.getElementById("zielSelect").value;
    const via = document.getElementById("viaSelect").value; // Wert enthält bereits .mp3
    const sonder = document.getElementById("sonderSelect").value; // Wert enthält bereits .mp3

    // Array für die URLs der abzuspielenden Audio-Fragmente in der korrekten Reihenfolge
    const urls = [];

    // 1. Linie oder Zug
    if (line) {
        // Linie Nummer XX
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
         // Annahme: Die Zahlendateien sind unter Nummern/line_number_end/XX.mp3 gespeichert
         // Fügen Sie .mp3 hier wieder hinzu, da die Nummer selbst keine Endung hat
        urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3");
    } else {
        // Zug
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    // 2. Ziel (Ziel ist obligatorisch für eine sinnvolle Ansage)
    if (ziel && ziel !== "") { // Prüfen, ob ein Ziel ausgewählt wurde (nicht der Standard-Leerwert)
        urls.push(GITHUB_BASE + "Fragmente/nach.mp3");
         // Der Ziel-Wert enthält bereits die .mp3-Endung aus dem Select-Option-Value
        urls.push(GITHUB_BASE + "Ziele/" + encodeURIComponent(ziel));
    } else {
        alert("Bitte wählen Sie ein Fahrziel aus, um die Ansage zu erstellen.");
        console.warn("Ansage abgebrochen: Kein Ziel ausgewählt.");
        return; // Ansage kann ohne Ziel nicht sinnvoll abgespielt werden
    }

    // 3. Via (optional)
    // Prüfen, ob ein Via-Wert ausgewählt wurde (nicht der Standard-Leerwert "")
    // und ob der Wert nicht "keine.mp3" ist (falls dies eine explizite Option ist)
    if (via && via !== "" && via !== "keine.mp3") {
        // Fügen Sie den "über"-Schnipsel hinzu (wahrscheinlich Dateiname ueber.mp3)
        urls.push(GITHUB_BASE + "Fragmente/ueber.mp3"); // <-- Korrigierter Dateiname?
         // Fügen Sie die Via-Haltestelle hinzu (Wert enthält bereits die .mp3-Endung)
        urls.push(GITHUB_BASE + "via/" + encodeURIComponent(via));
    }
    // Wenn via === "" oder via === "keine.mp3", wird dieser Block übersprungen.

    // 4. Sonderansage (optional)
    // Prüfen, ob ein Sonderansage-Wert ausgewählt wurde (nicht der Standard-Leerwert "")
    if (sonder && sonder !== "") {
         // Der Sonder-Wert enthält bereits die .mp3-Endung
         // Die Sonderansage wird direkt am Ende der Sequenz angehängt
        urls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder));
    }

    // Überprüfen Sie das final konstruierte URL-Array
    console.log("Konstruierte URLs für die Ansage:", urls);

    // Starten Sie die Wiedergabe der Sequenz
    if (urls.length > 0) {
        startPlayback(urls);
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
        startPlayback([url]); // Einzelne URL als Sequenz starten
    } else {
        alert("Bitte wählen Sie eine Sonderansage aus.");
    }
}

// Funktion, um nur die Via-Ansage abzuspielen ("über" + Via-Haltestelle)
function playOnlyVia() {
    const via = document.getElementById("viaSelect").value;
    // Prüfen, ob via ausgewählt ist und nicht "– Keine Via –" (der leere Standard-Value)
    // und nicht "keine.mp3" ist
    if (via && via !== "" && via !== "keine.mp3") {
         // Die Via-Werte enthalten bereits die .mp3-Endung
        const viaUrls = [
             GITHUB_BASE + "Fragmente/ueber.mp3", // <-- Korrigierter Dateiname?
             GITHUB_BASE + "via/" + encodeURIComponent(via)
        ];
        console.log("Spiele nur Via ab:", viaUrls);
        startPlayback(viaUrls); // Sequenz "über" + Via starten
    } else {
        alert("Bitte wählen Sie eine gültige Via-Haltestelle aus.");
    }
}

// Event-Listener für die Buttons
document.getElementById("playBtn").addEventListener("click", playAnnouncement);
document.getElementById("sonderBtn").addEventListener("click", playOnlySonderansage);
document.getElementById("viaBtn").addEventListener("click", playOnlyVia);

// Dropdowns laden, sobald das DOM bereit ist
document.addEventListener("DOMContentLoaded", loadDropdowns);
