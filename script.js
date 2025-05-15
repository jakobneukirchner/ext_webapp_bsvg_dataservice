const GITHUB_BASE = "https://raw.githubusercontent.com/jakobneukirchner/ext_webapp_bsvg/main/";

// Globale Variablen zur Steuerung der Wiedergabe
let currentAudio = null; // Aktuelles Audio-Element
let audioUrls = []; // Die Liste der URLs, die abgespielt werden sollen
let currentIndex = 0; // Der Index des aktuell abzuspielenden Titels im audioUrls-Array

// Globale Variable für verfügbare Liniennummer-Dateinamen (z.B. ["1.mp3", "4.mp3", "M1.mp3"])
let availableLineNumberFiles = [];


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
         // Spezifische Prüfung, ob es die Liniennummer-Datei war
        if (url.includes("/Nummern/line_number_end/")) {
             console.error("Fehler beim Laden der Liniennummer-Audio-Datei. Die eingegebene Nummer ist wahrscheinlich ungültig oder die Datei fehlt auf GitHub.");
             // alert(`Fehler: Audio-Datei für Liniennummer konnte nicht geladen werden. Ist "${decodeURIComponent(url.split('/').pop().replace('.mp3', ''))}" korrekt?`);
        }
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
        // Auch hier springen wir zum nächsten Titel, damit die Sequenz weiterläuft.
        currentIndex++;
        playNextAudio();
         if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
             console.warn("Wiedergabe wurde möglicherweise vom Browser blockiert. Benutzerinteraktion erforderlich?");
         }
    });
}

// Funktion zur Validierung der Liniennummer
// Prüft, ob eine Datei mit dem Namen "[Nummer].mp3" im geladenen Nummern-Verzeichnis existiert
function isValidLineNumber(lineNumber) {
    if (!lineNumber || lineNumber.trim() === "") {
        return true; // Leere Eingabe ist "gültig" im Sinne von "keine Linie gewählt"
    }
    // availableLineNumberFiles enthält die reinen Dateinamen (z.B. ["4.mp3", "M1.mp3"])
    // Wir prüfen, ob der vom Benutzer eingegebene Text + ".mp3" in dieser Liste ist.
    const filenameToCheck = lineNumber.trim() + ".mp3";

    return availableLineNumberFiles.includes(filenameToCheck);
}


// Funktion, um ein Formularfeld als ungültig zu markieren
function markFieldInvalid(elementId, isInvalid) {
    const element = document.getElementById(elementId);
    if (element) {
        if (isInvalid) {
            element.classList.add("is-invalid");
        } else {
            element.classList.remove("is-invalid");
        }
    }
}


// Lädt die Dropdowns für Ziel, Via, Sonderansagen und Gong
// Lädt auch die Liste der verfügbaren Liniennummern-Dateien für die Validierung
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
    availableLineNumberFiles = []; // Liste der Nummern zurücksetzen


    // Helper function to fetch and return a list of .mp3 filenames
    async function fetchMp3Filenames(path) {
        console.log(`Versuche Dateien von ${path} zu laden...`);
        try {
            const response = await fetch(`https://api.github.com/repos/jakobneukirchner/ext_webapp_bsvg/contents/${path}`);

            if (!response.ok) {
                 console.warn(`Konnte Daten für ${path} nicht laden (Status: ${response.status}).`);
                 if (response.status === 404) {
                     console.warn(`Pfad nicht gefunden oder leer: ${path}`);
                     return []; // Leeres Array bei 404 (Ordner leer/fehlt)
                 }
                 throw new Error(`HTTP error! status: ${response.status}`);
            }

            const files = await response.json();
            const mp3Files = files
                .filter(file => file.type === 'file' && file.name.endsWith(".mp3"))
                .map(file => file.name); // Gibt nur die reinen Dateinamen zurück (z.B. "Datei.mp3")

            if (mp3Files.length === 0) {
                 console.warn(`Keine .mp3 Dateien im Ordner ${path} gefunden.`);
            } else {
                 console.log(`Erfolgreich ${mp3Files.length} .mp3 Dateien von ${path} geladen.`);
            }
            return mp3Files;


        } catch (error) {
            console.error(`Netzwerk- oder anderer Fehler beim Laden von ${path}:`, error);
            return []; // Bei jedem Fehler leeres Array zurückgeben
        }
    }

    console.log("Lade Dropdowns und Nummern-Dateiliste...");
    // Laden Sie alle Daten parallel
    // Wir speichern die rohen Dateinamen (encodeURIComponent wird später beim Bauen der URL angewendet)
    const [zielFiles, viaFiles, sonderFiles, gongFiles, numberFiles] = await Promise.all([
        fetchMp3Filenames("Ziele"),
        fetchMp3Filenames("via"),
        fetchMp3Filenames("Hinweise"),
        fetchMp3Filenames("gong"),
        fetchMp3Filenames("Nummern/line_number_end") // Laden der Liniennummer-Dateien für Validierung
    ]);

    // Befüllen Sie jetzt die Dropdowns mit den geladenen Dateien
    // Der Option-Value ist der Dateiname (z.B. "Datei.mp3")
    // Der Option-Text ist der dekodierte Dateiname (z.B. "Datei.mp3", falls keine Umlaute)
    zielFiles.forEach(name => zielSelect.add(new Option(decodeURIComponent(name), name)));
    viaFiles.forEach(name => viaSelect.add(new Option(decodeURIComponent(name), name)));
    sonderFiles.forEach(name => sonderSelect.add(new Option(decodeURIComponent(name), name)));
    gongFiles.forEach(name => gongSelect.add(new Option(decodeURIComponent(name), name)));

    // Speichern Sie die Liniennummer-Dateinamen global für die Validierung
    availableLineNumberFiles = numberFiles;
    console.log("Verfügbare Liniennummer-Dateien für Validierung:", availableLineNumberFiles);


    console.log("Alle Dropdowns und Nummernliste geladen.");

    // Event Listener für die Gong-Checkbox hinzufügen
    setupGongCheckboxListener(); // Prüft jetzt auch, ob Gongs geladen wurden
    // Event Listener für die Formularfelder einrichten (Validierung bei blur, Markierung bei input/focus/change)
    setupFormFieldListeners();
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
                    // Optional: Markierung entfernen, wenn Checkbox angehakt und Dropdown sichtbar wird
                    // markFieldInvalid('gongSelect', false);
                 } else {
                    console.warn("Gong-Checkbox angehakt, aber keine Gong-Dateien verfügbar.");
                    this.checked = false; // Deaktiviert die Checkbox
                    alert("Es wurden keine Gong-Dateien gefunden oder geladen. Die Option wird deaktiviert."); // Deutlichere Meldung
                    container.style.display = 'none'; // Verstecke das Dropdown wieder
                 }
            } else {
                container.style.display = 'none'; // Verstecke das Dropdown
                 gongSelect.value = ""; // Setze Wert zurück
                 markFieldInvalid('gongSelect', false); // Markierung entfernen
            }
        });
         // Initialen Zustand beim Laden der Seite: Dropdown verstecken
         container.style.display = 'none';

    } else {
         console.error("Gong Checkbox, Container oder Select nicht gefunden!");
    }
}

// Funktion, um Event-Listener für alle relevanten Formularfelder einzurichten
function setupFormFieldListeners() {
    const lineInput = document.getElementById("lineInput");
    const zielSelect = document.getElementById("zielSelect");
    const viaSelect = document.getElementById("viaSelect");
    const sonderSelect = document.getElementById("sonderSelect");
    const gongSelect = document.getElementById("gongSelect");

    if (lineInput) {
         // Entferne Fehlermarkierung bei Input oder Fokus
         lineInput.addEventListener('input', () => markFieldInvalid('lineInput', false));
         lineInput.addEventListener('focus', () => markFieldInvalid('lineInput', false));
         // Validiere bei Verlassen des Feldes
         lineInput.addEventListener('blur', (event) => {
             const lineNumber = event.target.value.trim();
             if (lineNumber !== "" && !isValidLineNumber(lineNumber)) {
                 markFieldInvalid('lineInput', true);
                 console.warn(`Liniennummer "${lineNumber}" ist ungültig.`);
             } else {
                 markFieldInvalid('lineInput', false);
             }
         });
    } else console.error("Linien-Input-Feld nicht gefunden!");

    // Bei Selects die Markierung bei Änderung oder Fokus entfernen
     if (zielSelect) {
         zielSelect.addEventListener('change', () => markFieldInvalid('zielSelect', false));
         zielSelect.addEventListener('focus', () => markFieldInvalid('zielSelect', false));
     } else console.error("Ziel-Select nicht gefunden!");

     if (viaSelect) {
         viaSelect.addEventListener('change', () => markFieldInvalid('viaSelect', false));
         viaSelect.addEventListener('focus', () => markFieldInvalid('viaSelect', false));
     } else console.error("Via-Select nicht gefunden!");

     if (sonderSelect) {
         sonderSelect.addEventListener('change', () => markFieldInvalid('sonderSelect', false));
         sonderSelect.addEventListener('focus', () => markFieldInvalid('sonderSelect', false));
     } else console.error("Sonder-Select nicht gefunden!");

     if (gongSelect) {
         gongSelect.addEventListener('change', () => markFieldInvalid('gongSelect', false));
         gongSelect.addEventListener('focus', () => markFieldInvalid('gongSelect', false));
     } else console.error("Gong-Select nicht gefunden!");

    // Listener für die Gong-Checkbox wird separat in setupGongCheckboxListener eingerichtet
}


// Funktion, um die vollständige Ansage abzuspielen (Gong(optional) -> Linie/Zug -> Ziel -> Via(optional) -> Sonder(optional))
function playAnnouncement() {
    const line = document.getElementById("lineInput").value.trim();
    const ziel = document.getElementById("zielSelect").value; // Wert enthält bereits .mp3
    const via = document.getElementById("viaSelect").value; // Wert enthält bereits .mp3
    const sonder = document.getElementById("sonderSelect").value; // Wert enthält bereits .mp3

    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    // Reset aller Fehlermarkierungen zu Beginn
    markFieldInvalid('lineInput', false);
    markFieldInvalid('zielSelect', false);
    markFieldInvalid('viaSelect', false);
    markFieldInvalid('sonderSelect', false);
    markFieldInvalid('gongSelect', false);


    // --- VALIDIERUNG ---
    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    // 1. Ziel ist obligatorisch
    if (ziel === "") {
        markFieldInvalid('zielSelect', true);
        alertMessage += "- Fahrziel muss ausgewählt werden.\n";
        isValid = false;
    }

    // 2. Linie, falls eingegeben, muss gültig sein
    if (line !== "" && !isValidLineNumber(line)) {
        markFieldInvalid('lineInput', true);
        alertMessage += `- Ungültige Liniennummer "${line}".\n`;
        isValid = false;
    }

    // 3. Gong, falls Option aktiv, muss ausgewählt sein
    if (includeGong && selectedGong === "") {
        markFieldInvalid('gongSelect', true);
        alertMessage += "- Gong ist ausgewählt, aber kein Gong gewählt.\n";
        isValid = false;
    }

    // Via und Sonder sind optional in dieser Ansage, brauchen hier keine 'erforderlich'-Validierung

    if (!isValid) {
        alert(alertMessage);
        console.warn("Ansage abgebrochen: Validierungsfehler.");
        return; // Ansage abbrechen
    }
    // --- ENDE VALIDIERUNG ---


    // Array für die URLs der abzuspielenden Audio-Fragmente
    const urls = [];

    // 0. Gong (optional) - Zuerst hinzufügen!
    if (includeGong && selectedGong !== "") { // Wurde bereits als gültig geprüft
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    }


    // 1. Linie oder Zug
    if (line) { // Wurde bereits als gültig geprüft, falls nicht leer
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
        urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3");
    } else {
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    // 2. Ziel (obligatorisch)
    urls.push(GITHUB_BASE + "Fragmente/nach.mp3"); // Ziel wurde bereits als gültig geprüft
    urls.push(GITHUB_BASE + "Ziele/" + encodeURIComponent(ziel));


    // 3. Via (optional)
    if (via && via !== "" && via !== "keine.mp3") {
        urls.push(GITHUB_BASE + "Fragmente/ueber.mp3");
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

// Funktion, um nur die Sonderansage abzuspielen (Gong(optional) -> Sonder)
function playOnlySonderansage() {
    const sonder = document.getElementById("sonderSelect").value;

    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    // Reset Fehlermarkierungen zu Beginn
    markFieldInvalid('sonderSelect', false);
    markFieldInvalid('gongSelect', false);


    // --- VALIDIERUNG ---
    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    // 1. Sonderansage ist obligatorisch für DIESE Ansage
    if (sonder === "") {
        markFieldInvalid('sonderSelect', true);
        alertMessage += "- Sonderansage muss ausgewählt werden.\n";
        isValid = false;
    }

     // 2. Gong, falls Option aktiv, muss ausgewählt sein
    if (includeGong && selectedGong === "") {
        markFieldInvalid('gongSelect', true);
        alertMessage += "- Gong ist ausgewählt, aber kein Gong gewählt.\n";
        isValid = false;
    }

    // Linie, Ziel, Via sind optional für DIESE Ansage

    if (!isValid) {
        alert(alertMessage);
        console.warn("'Nur Sonderansage' abgebrochen: Validierungsfehler.");
        return; // Ansage abbrechen
    }
    // --- ENDE VALIDIERUNG ---


    const urls = [];

    // 0. Gong (optional) - Zuerst hinzufügen!
    if (includeGong && selectedGong !== "") { // Validiert
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    }

    // 1. Sonderansage (obligatorisch für DIESE Ansage)
    urls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder)); // Validiert

    console.log("Konstruierte URLs für 'Nur Sonderansage':", urls);
    startPlayback(urls);
}

// Funktion, um nur die Via-Ansage abzuspielen (Gong(optional) -> Linie/Zug -> über -> Via)
function playOnlyVia() {
    const line = document.getElementById("lineInput").value.trim();
    const via = document.getElementById("viaSelect").value; // Wert enthält bereits .mp3

    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    // Reset Fehlermarkierungen zu Beginn
    markFieldInvalid('lineInput', false);
    markFieldInvalid('viaSelect', false);
    markFieldInvalid('gongSelect', false);


     // --- VALIDIERUNG ---
    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    // 1. Via ist obligatorisch für DIESE Ansage (und darf nicht "keine.mp3" sein)
    if (via === "" || via === "keine.mp3") {
        markFieldInvalid('viaSelect', true);
        alertMessage += "- Via Haltestelle muss ausgewählt werden.\n";
        isValid = false;
    }

     // 2. Linie, falls eingegeben, muss gültig sein
    if (line !== "" && !isValidLineNumber(line)) {
        markFieldInvalid('lineInput', true);
        alertMessage += `- Ungültige Liniennummer "${line}".\n`;
        isValid = false;
    }

     // 3. Gong, falls Option aktiv, muss ausgewählt sein
    if (includeGong && selectedGong === "") {
        markFieldInvalid('gongSelect', true);
        alertMessage += "- Gong ist ausgewählt, aber kein Gong gewählt.\n";
        isValid = false;
    }

    // Ziel und Sonder sind optional für DIESE Ansage

    if (!isValid) {
        alert(alertMessage);
        console.warn("'Nur Via' Ansage abgebrochen: Validierungsfehler.");
        return; // Ansage abbrechen
    }
    // --- ENDE VALIDIERUNG ---


     const urls = [];

    // 0. Gong (optional) - Zuerst hinzufügen!
    if (includeGong && selectedGong !== "") { // Validiert
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    }

    // 1. Linie oder Zug (immer dabei, auch wenn keine Linie eingegeben)
     if (line) { // Validiert, falls nicht leer
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
        urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3");
    } else {
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    // 2. Via (obligatorisch für DIESE Ansage)
    urls.push(GITHUB_BASE + "Fragmente/ueber.mp3");
    urls.push(GITHUB_BASE + "via/" + encodeURIComponent(via)); // Validiert

    console.log("Konstruierte URLs für 'Nur Via':", urls);
    startPlayback(urls);
}

// Funktion, um nur den ausgewählten Gong abzuspielen
function playOnlyGong() {
    const selectedGong = document.getElementById("gongSelect").value;
    const includeGong = document.getElementById("includeGongCheckbox").checked; // Prüfen, ob die Option überhaupt aktiv ist

     // Reset Fehlermarkierung zu Beginn
    markFieldInvalid('gongSelect', false);


     // --- VALIDIERUNG ---
    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    // 1. Gong muss ausgewählt sein (Checkbox muss NICHT aktiv sein, da dieser Button spezifisch ist)
    if (selectedGong === "") {
        markFieldInvalid('gongSelect', true);
        alertMessage += "- Gong muss ausgewählt werden, um nur Gong abzuspielen.\n";
        isValid = false;
    }

     // Hier keine weitere Validierung, da nur der Gong relevant ist

    if (!isValid) {
        alert(alertMessage);
        console.warn("'Nur Gong' abgebrochen: Validierungsfehler.");
        return; // Ansage abbrechen
    }
    // --- ENDE VALIDIERUNG ---

    // URL für den ausgewählten Gong
    const gongUrl = GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong);
    console.log("Spiele nur Gong ab:", gongUrl);
    startPlayback([gongUrl]); // Einzelne URL als Sequenz starten
}


// Event-Listener für die Buttons
document.getElementById("playBtn").addEventListener("click", playAnnouncement);
document.getElementById("sonderBtn").addEventListener("click", playOnlySonderansage);
document.getElementById("viaBtn").addEventListener("click", playOnlyVia);
document.getElementById("gongBtn").addEventListener("click", playOnlyGong); // Listener für neuen Button

// Dropdowns laden, Nummernliste laden und Listener einrichten, sobald das DOM bereit ist
document.addEventListener("DOMContentLoaded", () => {
    loadDropdowns(); // Ruft setupGongCheckboxListener und setupFormFieldListeners auf
});
