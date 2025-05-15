const GITHUB_BASE = "https://raw.githubusercontent.com/jakobneukirchner/ext_webapp_bsvg/main/";

// Globale Variablen zur Steuerung der Wiedergabe
let currentAudio = null; // Aktuelles Audio-Element
let audioUrls = []; // Die Liste der URLs, die abgespielt werden sollen
let currentIndex = 0; // Der Index des aktuell abzuspielenden Titels im audioUrls-Array

// In dieser Version wird die Liste der Nummern-Dateien nicht global gespeichert
// und die Validierung basiert nicht auf dieser Liste.

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
    if (!urls || urls.length === 0) {
        console.warn("Keine URLs zum Abspielen übergeben.");
        return;
    }
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

     // Prüfen, ob die URL gültig ist (nicht null, undefined, leer oder nur Whitespace)
    if (!url || typeof url !== 'string' || url.trim() === '') {
        console.error(`Ungültige oder leere URL übersprungen bei Index ${currentIndex}:`, url);
        currentIndex++; // Springe zum nächsten Titel
        playNextAudio(); // Versuche den nächsten Titel
        return;
    }


    currentAudio = new Audio(url);

    // Fehlerbehandlung: Wenn ein Titel nicht geladen oder abgespielt werden kann
    currentAudio.onerror = (e) => {
        console.error(`Fehler beim Laden oder Abspielen von ${url}:`, e);
        // In dieser Version wird die Liniennummer hier nicht speziell geprüft.
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
         if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
             console.warn("Wiedergabe wurde möglicherweise vom Browser blockiert. Benutzerinteraktion erforderlich?");
         }
    });
}


// In dieser Version gibt es keine isValidLineNumber Funktion
// und keine Markierung des Linien-Input-Feldes.


// Lädt die Dropdowns für Ziel, Via, Sonderansagen und Gong
async function loadDropdowns() {
    const zielSelect = document.getElementById("zielSelect");
    const viaSelect = document.getElementById("viaSelect");
    const sonderSelect = document.getElementById("sonderSelect");
    const gongSelect = document.getElementById("gongSelect"); // Neues Gong-Dropdown

    // Leeren Sie die Dropdowns zuerst (außer den Standard-Optionen)
    while (zielSelect.options.length > 1) zielSelect.remove(1);
    while (viaSelect.options.length > 1) viaSelect.remove(1);
    while (sonderSelect.options.length > 1) sonderSelect.remove(1);
    while (gongSelect.options.length > 1) gongSelect.remove(1);


    // Helper function to fetch and populate select dropdowns
    async function fetchAndPopulateSelect(path, selectElement) {
         console.log(`Versuche Dropdown-Daten von ${path} zu laden...`);
        try {
            const response = await fetch(`https://api.github.com/repos/jakobneukirchner/ext_webapp_bsvg/contents/${path}`);

            if (!response.ok) {
                 console.warn(`Konnte Dropdown-Daten für ${path} nicht laden (Status: ${response.status}).`);
                 if (response.status === 404) {
                     console.warn(`Pfad nicht gefunden oder leer: ${path}`);
                 }
                 return; // Bei Fehler oder 404 abbrechen
            }

            const files = await response.json();
             let filesFound = 0;

            files.forEach(file => {
                if (file.type === 'file' && file.name.endsWith(".mp3")) {
                    const name = decodeURIComponent(file.name);
                    selectElement.add(new Option(name, name)); // Wert und Text sind Dateiname (inkl. .mp3)
                    filesFound++;
                }
            });

             if (filesFound === 0 && selectElement.options.length <= 1) {
                  console.warn(`Keine .mp3 Dateien für Dropdown in ${path} gefunden.`);
             } else {
                  console.log(`Erfolgreich ${filesFound} .mp3 Dateien für Dropdown in ${path} geladen.`);
             }


        } catch (error) {
            console.error(`Netzwerk- oder anderer Fehler beim Laden von ${path}:`, error);
        }
    }

    console.log("Lade Dropdowns...");
    // Dropdowns parallel laden
    await Promise.all([
        fetchAndPopulateSelect("Ziele", zielSelect),
        fetchAndPopulateSelect("via", viaSelect),
        fetchAndPopulateSelect("Hinweise", sonderSelect),
        fetchAndPopulateSelect("gong", gongSelect)
    ]);

    console.log("Alle Dropdowns geladen.");

    // Event Listener für die Gong-Checkbox hinzufügen
    setupGongCheckboxListener();
    // In dieser Version gibt es keinen setupLineInputListener.
}

// Funktion, um den Zustand der Gong-Checkbox zu überwachen
function setupGongCheckboxListener() {
    const checkbox = document.getElementById("includeGongCheckbox");
    const container = document.getElementById("gongSelectContainer");
    const gongSelect = document.getElementById("gongSelect");


    if (checkbox && container && gongSelect) {
        // Listener hinzufügen
        checkbox.addEventListener('change', function() {
             const gongsAvailable = gongSelect.options.length > 1;
            if (this.checked) {
                 if (gongsAvailable) {
                    container.style.display = 'flex'; // Zeige das Dropdown an
                 } else {
                    console.warn("Gong-Checkbox angehakt, aber keine Gong-Dateien verfügbar.");
                    this.checked = false;
                    alert("Es wurden keine Gong-Dateien gefunden oder geladen. Die Option wird deaktiviert.");
                    container.style.display = 'none';
                 }
            } else {
                container.style.display = 'none'; // Verstecke das Dropdown
                 gongSelect.value = ""; // Setze Wert zurück
            }
        });
         // Initialen Zustand beim Laden der Seite: Dropdown verstecken
         container.style.display = 'none';

    } else {
         console.error("Gong Checkbox, Container oder Select nicht gefunden!");
    }
}


// Funktion, um die vollständige Ansage abzuspielen (Gong(optional) -> Linie/Zug -> Ziel -> Via(optional) -> Sonder(optional))
function playAnnouncement() {
    const line = document.getElementById("lineInput").value.trim();
    const ziel = document.getElementById("zielSelect").value; // Wert enthält bereits .mp3
    const via = document.getElementById("viaSelect").value; // Wert enthält bereits .mp3
    const sonder = document.getElementById("sonderSelect").value; // Wert enthält bereits .mp3

    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;


    // In dieser Version gibt es keine Validierung der Liniennummer gegen eine Liste.
    // Die Liniennummer wird einfach im URL verwendet.


    // Array für die URLs der abzuspielenden Audio-Fragmente
    const urls = [];

    // 0. Gong (optional) - Zuerst hinzufügen! (Nur bei vollständiger Ansage)
    if (includeGong && selectedGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    } else if (includeGong) {
         console.warn("Gong Option aktiviert, aber kein Gong ausgewählt. Gong wird übersprungen.");
    }


    // 1. Linie oder Zug
    if (line) {
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
        urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3"); // <-- Verwendet die eingegebene Nummer
    } else {
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    // 2. Ziel (Ziel ist obligatorisch)
    if (ziel && ziel !== "") {
        urls.push(GITHUB_BASE + "Fragmente/nach.mp3");
        urls.push(GITHUB_BASE + "Ziele/" + encodeURIComponent(ziel));
    } else {
        alert("Bitte wählen Sie ein Fahrziel aus.");
        console.warn("Vollständige Ansage abgebrochen: Kein Ziel ausgewählt.");
        return;
    }

    // 3. Via (optional)
    if (via && via !== "" && via !== "keine.mp3") { // Prüfen auf "" und "keine.mp3" (falls Option existiert)
        urls.push(GITHUB_BASE + "Fragmente/ueber.mp3"); // <-- Korrigierter Dateiname
        urls.push(GITHUB_BASE + "via/" + encodeURIComponent(via));
    }

    // 4. Sonderansage (optional)
    if (sonder && sonder !== "") {
        urls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder));
    }

    console.log("Konstruierte URLs für die vollständige Ansage:", urls);

     if (urls.length > 0) {
         startPlayback(urls);
     } else {
         console.warn("Keine URLs zum Abspielen konstruiert.");
     }
}

// Funktion, um nur die Sonderansage abzuspielen (OHNE Gong in dieser Version)
function playOnlySonderansage() {
    const sonder = document.getElementById("sonderSelect").value;

    // In dieser Version wird der Gong hier NICHT hinzugefügt.

    const urls = [];

    // 1. Sonderansage (obligatorisch für diese spezifische Ansage)
    if (sonder && sonder !== "") {
        urls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder));
    } else {
        alert("Bitte wählen Sie eine Sonderansage aus.");
        console.warn("'Nur Sonderansage' abgebrochen: Keine Sonderansage ausgewählt.");
        return;
    }

    console.log("Konstruierte URLs für 'Nur Sonderansage':", urls);
    startPlayback(urls);
}

// Funktion, um nur die Via-Ansage abzuspielen (OHNE Gong in dieser Version)
// (Linie/Zug -> über -> Via)
function playOnlyVia() {
    const line = document.getElementById("lineInput").value.trim();
    const via = document.getElementById("viaSelect").value; // Wert enthält bereits .mp3

     // In dieser Version gibt es keine Validierung der Liniennummer gegen eine Liste.
     // Die Liniennummer wird einfach im URL verwendet.
     // In dieser Version wird der Gong hier NICHT hinzugefügt.


     const urls = [];

    // 1. Linie oder Zug (immer dabei, auch wenn keine Linie eingegeben)
     if (line) {
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
        urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3"); // <-- Verwendet die eingegebene Nummer
    } else {
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    // 2. Via (Via ist obligatorisch für diese spezielle Ansage)
    if (via && via !== "" && via !== "keine.mp3") {
        urls.push(GITHUB_BASE + "Fragmente/ueber.mp3"); // <-- Korrigierter Dateiname
        urls.push(GITHUB_BASE + "via/" + encodeURIComponent(via));
    } else {
        alert("Bitte wählen Sie eine Via-Haltestelle aus, um diese Ansage zu erstellen ('Linie/Zug über Via').");
        console.warn("'Nur Via' Ansage abgebrochen: Keine Via-Haltestelle ausgewählt.");
        return;
    }

    console.log("Konstruierte URLs für 'Nur Via':", urls);
    startPlayback(urls);
}


// Event-Listener für die Buttons
document.getElementById("playBtn").addEventListener("click", playAnnouncement);
document.getElementById("sonderBtn").addEventListener("click", playOnlySonderansage);
document.getElementById("viaBtn").addEventListener("click", playOnlyVia);

// Dropdowns laden und Listener einrichten, sobald das DOM bereit ist
document.addEventListener("DOMContentLoaded", () => {
    loadDropdowns(); // Diese Funktion ruft jetzt auch setupGongCheckboxListener auf
});
