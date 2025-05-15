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
        // Hier könnten Sie spezifisches Feedback geben, z.B. wenn es die Liniennummer-Datei war
        if (url.includes("/Nummern/line_number_end/")) {
             console.error("Wahrscheinlich ungültige Liniennummer oder Datei fehlt auf GitHub.");
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

// Funktion zur Validierung der Liniennummer
// Prüft, ob eine Datei mit dem Namen "[Nummer].mp3" im geladenen Nummern-Verzeichnis existiert
function isValidLineNumber(lineNumber) {
    if (!lineNumber || lineNumber.trim() === "") {
        return true; // Leere Eingabe ist "gültig" im Sinne von "keine Linie gewählt"
    }
    // Prüfen, ob der Dateiname (z.B. "4.mp3" oder "M1.mp3") in unserer Liste der verfügbaren Dateien ist
    const requiredFilename = encodeURIComponent(lineNumber.trim()) + ".mp3"; // Kodieren, da URL enc. auch beim Laden passiert
    // Konvertieren Sie availableLineNumberFiles zu einem Set für schnellere Suchen, wenn die Liste sehr lang wäre
    // Derzeit reicht includes auf dem Array
    return availableLineNumberFiles.includes(requiredFilename);
}


// Funktion, um das Input-Feld als ungültig zu markieren
function markLineInputInvalid(isInvalid) {
    const lineInput = document.getElementById("lineInput");
    if (lineInput) {
        if (isInvalid) {
            lineInput.classList.add("is-invalid");
        } else {
            lineInput.classList.remove("is-invalid");
        }
    }
}


// Lädt die Dropdowns für Ziel, Via, Sonderansagen und Gong
// Lädt auch die Liste der verfügbaren Liniennummern-Dateien
async function loadDropdowns() {
    const zielSelect = document.getElementById("zielSelect");
    const viaSelect = document.getElementById("viaSelect");
    const sonderSelect = document.getElementById("sonderSelect");
    const gongSelect = document.getElementById("gongSelect"); // Neues Gong-Dropdown

    // Leeren Sie die Dropdowns zuerst (außer den Standard-Optionen)
    // Wir lassen die erste Option (index 0) unberührt
    while (zielSelect.options.length > 1) zielSelect.remove(1);
    while (viaSelect.options.length > 1) viaSelect.remove(1);
    while (sonderSelect.options.length > 1) sonderSelect.remove(1);
    while (gongSelect.options.length > 1) gongSelect.remove(1); // Gong-Dropdown leeren
    availableLineNumberFiles = []; // Liste der Nummern zurücksetzen


    // Helper function to fetch and populate
    // Diese Version gibt die gefundenen Dateinamen zurück
    async function fetchFiles(path) {
        try {
            const response = await fetch(`https://api.github.com/repos/jakobneukirchner/ext_webapp_bsvg/contents/${path}`);

            if (!response.ok) {
                 console.warn(`Konnte Daten für ${path} nicht laden (Status: ${response.status}).`);
                 // Bei 404 (Ordner leer/fehlt) leeres Array zurückgeben, bei anderen Fehlern Error werfen
                 if (response.status === 404) return [];
                 throw new Error(`HTTP error! status: ${response.status}`);
            }

            const files = await response.json();
            const mp3Files = files
                .filter(file => file.type === 'file' && file.name.endsWith(".mp3"))
                .map(file => file.name); // Gibt nur die Dateinamen zurück

            if (mp3Files.length === 0) {
                 console.warn(`Keine .mp3 Dateien im Ordner ${path} gefunden.`);
            }
            return mp3Files;


        } catch (error) {
            console.error(`Netzwerkfehler beim Laden von ${path}:`, error);
            // Bei Fehler leeres Array zurückgeben
            return [];
        }
    }

    console.log("Lade Dropdowns und Nummern-Dateiliste...");
    // Laden Sie alle Daten parallel
    const [zielFiles, viaFiles, sonderFiles, gongFiles, numberFiles] = await Promise.all([
        fetchFiles("Ziele"),
        fetchFiles("via"),
        fetchFiles("Hinweise"),
        fetchFiles("gong"),
        fetchFiles("Nummern/line_number_end") // Laden der Liniennummer-Dateien
    ]);

    // Befüllen Sie jetzt die Dropdowns mit den geladenen Dateien
    zielFiles.forEach(name => zielSelect.add(new Option(decodeURIComponent(name), name)));
    viaFiles.forEach(name => viaSelect.add(new Option(decodeURIComponent(name), name)));
    sonderFiles.forEach(name => sonderSelect.add(new Option(decodeURIComponent(name), name)));
    gongFiles.forEach(name => gongSelect.add(new Option(decodeURIComponent(name), name)));

    // Speichern Sie die Liniennummer-Dateinamen global
    availableLineNumberFiles = numberFiles;
    console.log("Verfügbare Liniennummer-Dateien:", availableLineNumberFiles);


    console.log("Alle Dropdowns und Nummernliste geladen.");

    // Event Listener für die Gong-Checkbox hinzufügen
    setupGongCheckboxListener();
    // Event Listener für das Linien-Input-Feld hinzufügen
    setupLineInputListener();
}

// Funktion, um den Zustand der Gong-Checkbox zu überwachen
function setupGongCheckboxListener() {
    const checkbox = document.getElementById("includeGongCheckbox");
    const container = document.getElementById("gongSelectContainer");
    const gongSelect = document.getElementById("gongSelect");


    if (checkbox && container && gongSelect) {
        // Listener hinzufügen
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                 // Nur anzeigen, wenn es auch tatsächlich Gong-Optionen gibt (mehr als nur die Standardoption)
                 if (gongSelect.options.length > 1) {
                     container.style.display = 'block'; // Zeige das Dropdown an
                 } else {
                     console.warn("Gong-Checkbox angehakt, aber keine Gong-Dateien verfügbar.");
                     this.checked = false; // Deaktiviert die Checkbox
                     alert("Es wurden keine Gong-Dateien gefunden oder geladen. Die Option wird deaktiviert."); // Deutlichere Meldung
                     container.style.display = 'none'; // Verstecke das Dropdown wieder
                 }
            } else {
                container.style.display = 'none'; // Verstecke das Dropdown
                 // Optional: Setze das Dropdown auf den Standardwert zurück, wenn es versteckt wird
                 gongSelect.value = "";
            }
        });

         // Initialen Zustand beim Laden der Seite: Dropdown verstecken
         container.style.display = 'none';

    } else {
         console.error("Gong Checkbox, Container oder Select nicht gefunden!");
    }
}

// Funktion, um den Event-Listener für das Linien-Input-Feld einzurichten
function setupLineInputListener() {
    const lineInput = document.getElementById("lineInput");
    if (lineInput) {
        // Entferne die Fehlermarkierung, sobald der Benutzer anfängt zu tippen oder das Feld fokussiert
        lineInput.addEventListener('input', () => markLineInputInvalid(false));
        lineInput.addEventListener('focus', () => markLineInputInvalid(false));
        // Optional: Validierung bei Verlassen des Feldes
        // lineInput.addEventListener('blur', (event) => {
        //     const lineNumber = event.target.value.trim();
        //     if (lineNumber !== "" && !isValidLineNumber(lineNumber)) {
        //         markLineInputInvalid(true);
        //     }
        // });
    } else {
        console.error("Linien-Input-Feld nicht gefunden!");
    }
}


// Funktion, um die vollständige Ansage abzuspielen (Gong(optional) -> Linie/Zug -> Ziel -> Via(optional) -> Sonder(optional))
function playAnnouncement() {
    const line = document.getElementById("lineInput").value.trim();
    const ziel = document.getElementById("zielSelect").value;
    const via = document.getElementById("viaSelect").value; // Wert enthält bereits .mp3
    const sonder = document.getElementById("sonderSelect").value; // Wert enthält bereits .mp3

    const includeGong = document.getElementById("includeGongCheckbox").checked; // Zustand der Checkbox
    const selectedGong = document.getElementById("gongSelect").value; // Ausgewählter Gong-Wert

    // **VALIDIERUNG DER LINUMMER HIER**
    if (line !== "" && !isValidLineNumber(line)) {
        markLineInputInvalid(true);
        alert(`Ungültige Liniennummer "${line}" eingegeben. Bitte korrigieren Sie die Eingabe.`);
        console.warn("Ansage abgebrochen: Ungültige Liniennummer.");
        return; // Ansage abbrechen, wenn Nummer ungültig ist
    } else {
         markLineInputInvalid(false); // Entferne Markierung, falls vorher gesetzt
    }


    // Array für die URLs der abzuspielenden Audio-Fragmente in der korrekten Reihenfolge
    const urls = [];

    // 0. Gong (optional) - Zuerst hinzufügen!
    // Nur hinzufügen, wenn Checkbox an und ein Gong ausgewählt ist (Wert ist nicht leer)
    if (includeGong && selectedGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong)); // Gong-URL hinzufügen
    } else if (includeGong && (!selectedGong || selectedGong === "")) {
        // Feedback, wenn Gong angehakt, aber keiner ausgewählt ist
        console.warn("Gong Option aktiviert, aber kein Gong ausgewählt. Gong wird übersprungen.");
         // Fahren Sie in diesem Fall fort, die restliche Ansage zu konstruieren und abzuspielen.
    }


    // 1. Linie oder Zug
    if (line) {
        // Linie Nummer XX
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
         // Annahme: Die Zahlendateien sind unter Nummern/line_number_end/XX.mp3 gespeichert
         // Fügen Sie .mp3 hier wieder hinzu, da die Nummer selbst keine Endung hat
        urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3"); // <-- Verwenden Sie die vom Benutzer eingegebene, validierte Nummer
    } else {
        // Zug
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    // 2. Ziel (Ziel ist obligatorisch für eine sinnvolle vollständige Ansage)
    if (ziel && ziel !== "") { // Prüfen, ob ein Ziel ausgewählt wurde (nicht der Standard-Leerwert)
        urls.push(GITHUB_BASE + "Fragmente/nach.mp3");
         // Der Ziel-Wert enthält bereits die .mp3-Endung aus dem Select-Option-Value
        urls.push(GITHUB_BASE + "Ziele/" + encodeURIComponent(ziel));
    } else {
        alert("Bitte wählen Sie ein Fahrziel aus, um die vollständige Ansage zu erstellen.");
        console.warn("Vollständige Ansage abgebrochen: Kein Ziel ausgewählt.");
        return; // Vollständige Ansage kann ohne Ziel nicht sinnvoll abgespielt werden
    }

    // 3. Via (optional)
    // Prüfen, ob ein Via-Wert ausgewählt wurde (nicht der Standard-Leerwert "")
    // und ob der Wert nicht "keine.mp3" ist (falls dies eine explizite Option ist)
    if (via && via !== "" && via !== "keine.mp3") {
        // Fügen Sie den "über"-Schnipsel hinzu (wahrscheinlich Dateiname ueber.mp3)
        urls.push(GITHUB_BASE + "Fragmente/ueber.mp3"); // <-- Korrigierter Dateiname
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
    console.log("Konstruierte URLs für die vollständige Ansage:", urls);

    // Starten Sie die Wiedergabe der Sequenz
     if (urls.length > 0) {
         startPlayback(urls);
     } else {
         console.warn("Keine URLs zum Abspielen konstruiert.");
     }
}

// Funktion, um nur die Sonderansage abzuspielen (Gong(optional) -> Sonder)
function playOnlySonderansage() {
    const sonder = document.getElementById("sonderSelect").value;

    const includeGong = document.getElementById("includeGongCheckbox").checked; // Zustand der Checkbox
    const selectedGong = document.getElementById("gongSelect").value; // Ausgewählter Gong-Wert

    const urls = [];

    // 0. Gong (optional) - Zuerst hinzufügen!
    if (includeGong && selectedGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong)); // Gong-URL hinzufügen
    } else if (includeGong && (!selectedGong || selectedGong === "")) {
         console.warn("Gong Option aktiviert, aber kein Gong ausgewählt. Gong wird übersprungen.");
    }


    // 1. Sonderansage (obligatorisch für diese spezifische Ansage)
    // Prüfen, ob Sonderansage ausgewählt wurde (nicht der leere Standard-Value)
    if (sonder && sonder !== "") {
         // Der Sonder-Wert enthält bereits die .mp3-Endung
        urls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder));
    } else {
        alert("Bitte wählen Sie eine Sonderansage aus, um diese abzuspielen.");
        console.warn("'Nur Sonderansage' abgebrochen: Keine Sonderansage ausgewählt.");
        return; // Abbruch, wenn keine Sonderansage gewählt ist
    }

    console.log("Konstruierte URLs für 'Nur Sonderansage':", urls);

    startPlayback(urls); // Starten Sie die Sequenz (Gong + Sonder)
}

// Funktion, um nur die Via-Ansage abzuspielen (Gong(optional) -> Linie/Zug -> über -> Via)
function playOnlyVia() {
    const line = document.getElementById("lineInput").value.trim();
    const via = document.getElementById("viaSelect").value; // Wert enthält bereits .mp3

    const includeGong = document.getElementById("includeGongCheckbox").checked; // Zustand der Checkbox
    const selectedGong = document.getElementById("gongSelect").value; // Ausgewählter Gong-Wert

    // **VALIDIERUNG DER LINUMMER HIER**
     if (line !== "" && !isValidLineNumber(line)) {
        markLineInputInvalid(true);
        alert(`Ungültige Liniennummer "${line}" eingegeben. Bitte korrigieren Sie die Eingabe.`);
        console.warn("'Nur Via' Ansage abgebrochen: Ungültige Liniennummer.");
        return; // Ansage abbrechen, wenn Nummer ungültig ist
    } else {
         markLineInputInvalid(false); // Entferne Markierung, falls vorher gesetzt
    }


     // Array für die URLs dieser spezifischen Ansage
    const urls = [];

    // 0. Gong (optional) - Zuerst hinzufügen!
    if (includeGong && selectedGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong)); // Gong-URL hinzufügen
    } else if (includeGong && (!selectedGong || selectedGong === "")) {
         console.warn("Gong Option aktiviert, aber kein Gong ausgewählt. Gong wird übersprungen.");
    }

    // 1. Linie oder Zug (immer dabei, auch wenn keine Linie eingegeben)
     if (line) {
        // Linie Nummer XX
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
        urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3"); // <-- Verwenden Sie die vom Benutzer eingegebene, validierte Nummer
    } else {
        // Zug
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    // 2. Via (Via ist obligatorisch für diese spezielle Ansage)
    // Prüfen, ob ein Via-Wert ausgewählt wurde (nicht der Standard-Leerwert "")
    // und ob der Wert nicht "keine.mp3" ist
    if (via && via !== "" && via !== "keine.mp3") {
        // Fügen Sie den "über"-Schnipsel hinzu
        urls.push(GITHUB_BASE + "Fragmente/ueber.mp3"); // <-- Korrigierter Dateiname
         // Fügen Sie die Via-Haltestelle hinzu (Wert enthält bereits die .mp3-Endung)
        urls.push(GITHUB_BASE + "via/" + encodeURIComponent(via));
    } else {
        alert("Bitte wählen Sie eine Via-Haltestelle aus, um diese Ansage zu erstellen ('Linie/Zug über Via').");
        console.warn("'Nur Via' Ansage abgebrochen: Keine Via-Haltestelle ausgewählt.");
        return; // Diese Ansage macht ohne Via-Haltestelle keinen Sinn
    }

    // Überprüfen Sie das final konstruierte URL-Array für "Nur Via"
    console.log("Konstruierte URLs für 'Nur Via':", urls);


    // Starten Sie die Wiedergabe der Sequenz
    startPlayback(urls);
}


// Event-Listener für die Buttons
document.getElementById("playBtn").addEventListener("click", playAnnouncement);
document.getElementById("sonderBtn").addEventListener("click", playOnlySonderansage);
document.getElementById("viaBtn").addEventListener("click", playOnlyVia);

// Dropdowns laden, Nummernliste laden und Listener einrichten, sobald das DOM bereit ist
document.addEventListener("DOMContentLoaded", () => {
    loadDropdowns(); // Diese Funktion ruft jetzt auch setupGongCheckboxListener und setupLineInputListener auf
});
