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
    // Wichtig: Setze die Wiedergabegeschwindigkeit, um Pausen zu minimieren
    // Standardmäßig ist es 1.0, falls keine spezifische Anpassung notwendig ist,
    // kann dies beibehalten oder für Experimente verändert werden.
    currentAudio.playbackRate = 1.0; 

    // Fehlerbehandlung: Wenn ein Titel nicht geladen oder abgespielt werden kann
    currentAudio.onerror = (e) => {
        console.error(`Fehler beim Laden oder Abspielen von ${url}:`, e);
        // Spezifische Prüfung, ob es die Liniennummer-Datei war
        if (url.includes("/Nummern/line_number_end/")) {
            console.error("Fehler beim Laden der Liniennummer-Audio-Datei. Die eingegebene Nummer ist wahrscheinlich ungültig oder die Datei fehlt auf GitHub.");
        }
        currentIndex++; // Springe zum nächsten Titel
        playNextAudio(); // Versuche den nächsten Titel
    };

    // Event-Listener für das Ende des aktuellen Titels
    // Die Audio-Dateien sollten keine unnötigen Pausen am Ende haben.
    // Ein `ended`-Event feuert, sobald die Datei wirklich zu Ende ist.
    currentAudio.onended = () => {
        console.log(`Beendet: ${url}`);
        currentIndex++; // Springe zum nächsten Titel
        playNextNextAudioWithMinimalDelay(); // Versuche den nächsten Titel mit minimaler Verzögerung
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
        playNextNextAudioWithMinimalDelay();
        if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
            console.warn("Wiedergabe wurde möglicherweise vom Browser blockiert. Benutzerinteraktion erforderlich?");
        }
    });
}

// Hilfsfunktion, um den nächsten Audio-Schnipsel mit minimaler Verzögerung zu starten
// Dies ist wichtig, um Überschneidungen zu vermeiden, aber gleichzeitig flüssig zu bleiben.
function playNextNextAudioWithMinimalDelay() {
    // Kurze Timeout, um die Event-Loop nicht zu blockieren und eine minimale Trennung zu gewährleisten.
    // 0ms ist oft ausreichend, um das onended-Event sauber zu verarbeiten und den nächsten play() Aufruf zu initiieren.
    // Experimentieren Sie hier bei Bedarf mit sehr kleinen Werten (z.B. 10-50ms), falls es immer noch zu Überlappungen oder zu schnellen Übergängen kommt.
    setTimeout(() => {
        playNextAudio();
    }, 0); 
}


// Funktion zur Validierung der Liniennummer
// Prüft, ob eine Datei mit dem Namen "[Nummer].mp3" im geladenen Nummern-Verzeichnis existiert
function isValidLineNumber(lineNumber) {
    if (!lineNumber || lineNumber.trim() === "") {
        return true; // Leere Eingabe ist "gültig" im Sinne von "keine Linie gewählt"
    }
    // availableLineNumberFiles enthält die reinen Dateinamen (z.B. ["4", "M1"])
    return availableLineNumberFiles.includes(lineNumber.trim());
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

// Lädt die Dropdowns für Ziel, Via, Sonderansagen, Gong und Liniennummern
async function loadDropdowns() {
    const lineSelect = document.getElementById("lineSelect"); // Neues Linien-Dropdown
    const zielSelect = document.getElementById("zielSelect");
    const viaSelect = document.getElementById("viaSelect");
    const sonderSelect = document.getElementById("sonderSelect");
    const gongSelect = document.getElementById("gongSelect");

    // Leeren Sie die Dropdowns zuerst (außer den Standard-Optionen)
    while (lineSelect.options.length > 1) lineSelect.remove(1);
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
    zielFiles.forEach(name => zielSelect.add(new Option(decodeURIComponent(name.replace(".mp3", "")), name)));
    viaFiles.forEach(name => viaSelect.add(new Option(decodeURIComponent(name.replace(".mp3", "")), name)));
    sonderFiles.forEach(name => sonderSelect.add(new Option(decodeURIComponent(name.replace(".mp3", "")), name)));
    gongFiles.forEach(name => gongSelect.add(new Option(decodeURIComponent(name.replace(".mp3", "")), name)));

    // Liniennummern-Dropdown befüllen
    numberFiles.forEach(name => lineSelect.add(new Option(decodeURIComponent(name.replace(".mp3", "")), name.replace(".mp3", ""))));

    // Speichern Sie die Liniennummer-Dateinamen global für die Validierung (ohne .mp3)
    availableLineNumberFiles = numberFiles.map(name => name.replace(".mp3", ""));
    console.log("Verfügbare Liniennummer-Dateien für Validierung:", availableLineNumberFiles);

    console.log("Alle Dropdowns und Nummernliste geladen.");

    // Event Listener für die Gong-Checkbox hinzufügen
    setupGongCheckboxListener();
    // Event Listener für die Formularfelder einrichten
    setupFormFieldListeners();
}

// Funktion, um den Zustand der Gong-Checkbox zu überwachen
function setupGongCheckboxListener() {
    const checkbox = document.getElementById("includeGongCheckbox");
    const container = document.getElementById("gongSelectContainer");
    const gongSelect = document.getElementById("gongSelect");

    if (checkbox && container && gongSelect) {
        checkbox.addEventListener('change', function() {
            const gongsAvailable = gongSelect.options.length > 1;
            if (this.checked) {
                if (gongsAvailable) {
                    container.style.display = 'flex';
                } else {
                    console.warn("Gong-Checkbox angehakt, aber keine Gong-Dateien verfügbar.");
                    this.checked = false;
                    showMessageBox("Es wurden keine Gong-Dateien gefunden oder geladen. Die Option wird deaktiviert.");
                    container.style.display = 'none';
                }
            } else {
                container.style.display = 'none';
                gongSelect.value = "";
                markFieldInvalid('gongSelect', false);
            }
        });
        container.style.display = 'none';
    } else {
        console.error("Gong Checkbox, Container oder Select nicht gefunden!");
    }
}

// Funktion, um Event-Listener für alle relevanten Formularfelder einzurichten
function setupFormFieldListeners() {
    const lineSelect = document.getElementById("lineSelect"); // Jetzt ein Select
    const zielSelect = document.getElementById("zielSelect");
    const viaSelect = document.getElementById("viaSelect");
    const sonderSelect = document.getElementById("sonderSelect");
    const gongSelect = document.getElementById("gongSelect");

    // Für Selects die Markierung bei Änderung oder Fokus entfernen
    if (lineSelect) {
        lineSelect.addEventListener('change', () => markFieldInvalid('lineSelect', false));
        lineSelect.addEventListener('focus', () => markFieldInvalid('lineSelect', false));
    } else console.error("Linien-Select-Feld nicht gefunden!");

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
}

/**
 * Generiert die URLs für die Ansage basierend auf den aktuellen Formularfeldern.
 * Diese Funktion wird sowohl für die Wiedergabe als auch für den Download verwendet.
 * @returns {string[]} Ein Array von URLs der Audiofragmente.
 */
function generateAnnouncementUrls() {
    const lineSelect = document.getElementById("lineSelect");
    const ziel = document.getElementById("zielSelect").value;
    const viaSelect = document.getElementById("viaSelect");
    const sonder = document.getElementById("sonderSelect").value;

    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    // Reset aller Fehlermarkierungen zu Beginn
    markFieldInvalid('lineSelect', false);
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

    // 2. Gong, falls Option aktiv, muss ausgewählt sein
    if (includeGong && selectedGong === "") {
        markFieldInvalid('gongSelect', true);
        alertMessage += "- Gong ist ausgewählt, aber kein Gong gewählt.\n";
        isValid = false;
    }

    if (!isValid) {
        showMessageBox(alertMessage);
        console.warn("Ansage abgebrochen: Validierungsfehler.");
        return []; // Leeres Array zurückgeben, wenn Validierung fehlschlägt
    }
    // --- ENDE VALIDIERUNG ---

    // Array für die URLs der abzuspielenden Audio-Fragmente
    const urls = [];

    // 0. Gong (optional) - Zuerst hinzufügen!
    if (includeGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    }

    // 1. Liniennummern oder Zug
    const selectedLines = Array.from(lineSelect.selectedOptions).map(option => option.value).filter(value => value !== "");
    if (selectedLines.length > 0) {
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
        selectedLines.forEach((line, index) => {
            urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3");
            if (index < selectedLines.length - 1) {
                // Korrektur: "und" Sprachschnipsel liegt unter Fragmente/und.mp3
                urls.push(GITHUB_BASE + "Fragmente/und.mp3"); 
            }
        });
    } else {
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    // 2. Ziel (obligatorisch)
    urls.push(GITHUB_BASE + "Fragmente/nach.mp3");
    urls.push(GITHUB_BASE + "Ziele/" + encodeURIComponent(ziel));

    // 3. Via (optional)
    const selectedViaOptions = Array.from(viaSelect.selectedOptions).filter(option => option.value !== "");
    if (selectedViaOptions.length > 0) {
        urls.push(GITHUB_BASE + "Fragmente/ueber.mp3");
        selectedViaOptions.forEach((option, index) => {
            urls.push(GITHUB_BASE + "via/" + encodeURIComponent(option.value));
            if (index < selectedViaOptions.length - 1) {
                // Korrektur: "und" Sprachschnipsel liegt unter Fragmente/und.mp3
                urls.push(GITHUB_BASE + "Fragmente/und.mp3"); 
            }
        });
    }

    // 4. Sonderansage (optional)
    if (sonder && sonder !== "") {
        // Zwischen Ansage und Sonderansage darf eine Pause bestehen bleiben.
        // Aktuell wird dies durch das sequentielle Abspielen der Audio-Dateien gehandhabt.
        // Wenn die Sonderansage nach der Hauptansage kommt, wird sie nach deren Ende abgespielt.
        // Ein explizites "Pause-Fragment" könnte hier eingefügt werden, falls die Pausenlänge nicht reicht.
        // Für eine "Reibungslose Wiedergabe" ohne Überschneidungen ist das `onended`-Event entscheidend.
        urls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder));
    }

    return urls;
}

// Funktion, um die vollständige Ansage abzuspielen
function playAnnouncement() {
    const urls = generateAnnouncementUrls();
    if (urls.length > 0) {
        console.log("Konstruierte URLs für die vollständige Ansage:", urls);
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

    markFieldInvalid('sonderSelect', false);
    markFieldInvalid('gongSelect', false);

    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    if (sonder === "") {
        markFieldInvalid('sonderSelect', true);
        alertMessage += "- Sonderansage muss ausgewählt werden.\n";
        isValid = false;
    }

    if (includeGong && selectedGong === "") {
        markFieldInvalid('gongSelect', true);
        alertMessage += "- Gong ist ausgewählt, aber kein Gong gewählt.\n";
        isValid = false;
    }

    if (!isValid) {
        showMessageBox(alertMessage);
        console.warn("'Nur Sonderansage' abgebrochen: Validierungsfehler.");
        return;
    }

    const urls = [];
    if (includeGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    }
    urls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder));

    console.log("Konstruierte URLs für 'Nur Sonderansage':", urls);
    startPlayback(urls);
}

// Funktion, um nur die Via-Ansage abzuspielen (Gong(optional) -> Linie/Zug -> über -> Via)
function playOnlyVia() {
    const lineSelect = document.getElementById("lineSelect");
    const viaSelect = document.getElementById("viaSelect");
    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    markFieldInvalid('lineSelect', false);
    markFieldInvalid('viaSelect', false);
    markFieldInvalid('gongSelect', false);

    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    const selectedViaOptions = Array.from(viaSelect.selectedOptions).filter(option => option.value !== "");
    if (selectedViaOptions.length === 0) {
        markFieldInvalid('viaSelect', true);
        alertMessage += "- Via Haltestelle(n) muss/müssen ausgewählt werden.\n";
        isValid = false;
    }

    if (includeGong && selectedGong === "") {
        markFieldInvalid('gongSelect', true);
        alertMessage += "- Gong ist ausgewählt, aber kein Gong gewählt.\n";
        isValid = false;
    }

    if (!isValid) {
        showMessageBox(alertMessage);
        console.warn("'Nur Via' Ansage abgebrochen: Validierungsfehler.");
        return;
    }

    const urls = [];
    if (includeGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    }

    const selectedLines = Array.from(lineSelect.selectedOptions).map(option => option.value).filter(value => value !== "");
    if (selectedLines.length > 0) {
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
        selectedLines.forEach((line, index) => {
            urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3");
            if (index < selectedLines.length - 1) {
                urls.push(GITHUB_BASE + "Fragmente/und.mp3");
            }
        });
    } else {
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    urls.push(GITHUB_BASE + "Fragmente/ueber.mp3");
    selectedViaOptions.forEach((option, index) => {
        urls.push(GITHUB_BASE + "via/" + encodeURIComponent(option.value));
        if (index < selectedViaOptions.length - 1) {
            urls.push(GITHUB_BASE + "Fragmente/und.mp3");
        }
    });

    console.log("Konstruierte URLs für 'Nur Via':", urls);
    startPlayback(urls);
}

// Funktion, um nur den ausgewählten Gong abzuspielen
function playOnlyGong() {
    const selectedGong = document.getElementById("gongSelect").value;

    markFieldInvalid('gongSelect', false);

    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    if (selectedGong === "") {
        markFieldInvalid('gongSelect', true);
        alertMessage += "- Gong muss ausgewählt werden, um nur Gong abzuspielen.\n";
        isValid = false;
    }

    if (!isValid) {
        showMessageBox(alertMessage);
        console.warn("'Nur Gong' abgebrochen: Validierungsfehler.");
        return;
    }

    const gongUrl = GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong);
    console.log("Spiele nur Gong ab:", gongUrl);
    startPlayback([gongUrl]);
}

// Funktion, um nur die Liniennummer(n) abzuspielen
function playOnlyLine() {
    const lineSelect = document.getElementById("lineSelect");
    const selectedLines = Array.from(lineSelect.selectedOptions).map(option => option.value).filter(value => value !== "");
    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    markFieldInvalid('lineSelect', false);
    markFieldInvalid('gongSelect', false);

    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    if (selectedLines.length === 0) {
        markFieldInvalid('lineSelect', true);
        alertMessage += "- Liniennummer(n) muss/müssen ausgewählt werden.\n";
        isValid = false;
    }
    if (includeGong && selectedGong === "") {
        markFieldInvalid('gongSelect', true);
        alertMessage += "- Gong ist ausgewählt, aber kein Gong gewählt.\n";
        isValid = false;
    }

    if (!isValid) {
        showMessageBox(alertMessage);
        console.warn("'Nur Linie(n)' abgebrochen: Validierungsfehler.");
        return;
    }

    const urls = [];
    if (includeGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    }

    urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
    selectedLines.forEach((line, index) => {
        urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3");
        if (index < selectedLines.length - 1) {
            urls.push(GITHUB_BASE + "Fragmente/und.mp3");
        }
    });
    console.log("Konstruierte URLs für 'Nur Linie(n)':", urls);
    startPlayback(urls);
}


/**
 * Zeigt ein benutzerdefiniertes Modal anstelle von alert().
 * @param {string} message Die anzuzeigende Nachricht.
 */
function showMessageBox(message) {
    const modalId = 'customMessageBox';
    let modal = document.getElementById(modalId);

    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'message-box-overlay';
        modal.innerHTML = `
            <div class="message-box-content">
                <p id="messageBoxText"></p>
                <button id="messageBoxCloseBtn">OK</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('messageBoxCloseBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    document.getElementById('messageBoxText').innerText = message;
    modal.style.display = 'flex'; // Zeigt das Modal an
}

/**
 * Lädt alle Audiofragmente, kombiniert sie und bietet sie als WAV-Datei zum Download an.
 * @param {string[]} urlsToDownload Ein Array von URLs der Audiofragmente, die heruntergeladen werden sollen.
 * @param {string} filename Der Dateiname für den Download.
 */
async function downloadAudioSequence(urlsToDownload, filename = 'ansage.wav') {
    if (urlsToDownload.length === 0) {
        showMessageBox("Es wurden keine Audio-URLs generiert, um sie herunterzuladen.");
        return;
    }

    try {
        showMessageBox("Ansage wird vorbereitet zum Download... Bitte warten.");

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffers = [];
        let totalLength = 0;

        for (const url of urlsToDownload) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP-Fehler beim Laden von ${url}: ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                audioBuffers.push(audioBuffer);
                totalLength += audioBuffer.length;
            } catch (error) {
                console.error(`Fehler beim Laden/Dekodieren von ${url}:`, error);
                // Überspringen Sie die fehlerhafte Datei und fahren Sie fort
            }
        }

        if (audioBuffers.length === 0) {
            showMessageBox("Keine gültigen Audio-Dateien zum Kombinieren gefunden.");
            return;
        }

        const outputBuffer = audioContext.createBuffer(
            audioBuffers[0].numberOfChannels,
            totalLength,
            audioContext.sampleRate
        );

        let offset = 0;
        for (const buffer of audioBuffers) {
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                outputBuffer.getChannelData(i).set(buffer.getChannelData(i), offset);
            }
            offset += buffer.length;
        }

        const wavBlob = audioBufferToWav(outputBuffer);

        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showMessageBox("Ansage erfolgreich heruntergeladen!");

    } catch (error) {
        console.error("Fehler beim Herunterladen der Ansage:", error);
        showMessageBox("Fehler beim Herunterladen der Ansage: " + error.message);
    }
}

/**
 * Konvertiert einen AudioBuffer in einen WAV-Blob.
 * Quelle: https://github.com/higuma/web-audio-recorder-js/blob/master/lib-min/web-audio-recorder.min.js
 * (Angepasst und vereinfacht für diesen Anwendungsfall)
 * @param {AudioBuffer} buffer Der zu konvertierende AudioBuffer.
 * @returns {Blob} Der WAV-Blob.
 */
function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels,
        btwLength = buffer.length * numOfChan * 2 + 44, // 2 bytes per sample, 44 bytes for header
        buf = new ArrayBuffer(btwLength),
        view = new DataView(buf),
        channels = [],
        sampleRate = buffer.sampleRate;

    let offset = 0;
    const writeString = (str) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };
    const writeUint16 = (val) => {
        view.setUint16(offset, val, true);
        offset += 2;
    };
    const writeUint32 = (val) => {
        view.setUint32(offset, val, true);
        offset += 4;
    };

    // RIFF identifier
    writeString('RIFF');
    offset += 4;
    // file length
    writeUint32(btwLength - 8);
    // RIFF type
    writeString('WAVE');
    offset += 4;
    // format chunk identifier
    writeString('fmt ');
    offset += 4;
    // format chunk length
    writeUint32(16);
    // sample format (raw)
    writeUint16(1);
    // channel count
    writeUint16(numOfChan);
    // sample rate
    writeUint32(sampleRate);
    // byte rate (sample rate * block align)
    writeUint32(sampleRate * numOfChan * 2);
    // block align (channel count * bytes per sample)
    writeUint16(numOfChan * 2);
    // bits per sample
    writeUint16(16);
    // data chunk identifier
    writeString('data');
    offset += 4;
    // data chunk length
    writeUint32(btwLength - offset);

    // Get all channel data
    for (let i = 0; i < numOfChan; i++) {
        channels.push(buffer.getChannelData(i));
    }

    // Interleave and write samples
    for (let i = 0; i < buffer.length; i++) {
        for (let j = 0; j < numOfChan; j++) {
            let sample = Math.max(-1, Math.min(1, channels[j][i]));
            sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
            view.setInt16(offset, sample, true);
            offset += 2;
        }
    }

    return new Blob([buf], { type: 'audio/wav' });
}

// --- Download-Funktionen für einzelne Typen ---

function downloadFullAnnouncement() {
    const urls = generateAnnouncementUrls();
    downloadAudioSequence(urls, 'vollstaendige_ansage.wav');
}

function downloadOnlySonderansage() {
    const sonder = document.getElementById("sonderSelect").value;
    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    markFieldInvalid('sonderSelect', false);
    markFieldInvalid('gongSelect', false);

    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    if (sonder === "") {
        markFieldInvalid('sonderSelect', true);
        alertMessage += "- Sonderansage muss ausgewählt werden.\n";
        isValid = false;
    }
    if (includeGong && selectedGong === "") {
        markFieldInvalid('gongSelect', true);
        alertMessage += "- Gong ist ausgewählt, aber kein Gong gewählt.\n";
        isValid = false;
    }

    if (!isValid) {
        showMessageBox(alertMessage);
        return;
    }

    const urls = [];
    if (includeGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    }
    urls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder));
    downloadAudioSequence(urls, 'sonderansage.wav');
}

function downloadOnlyVia() {
    const lineSelect = document.getElementById("lineSelect");
    const viaSelect = document.getElementById("viaSelect");
    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    markFieldInvalid('lineSelect', false);
    markFieldInvalid('viaSelect', false);
    markFieldInvalid('gongSelect', false);

    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    const selectedViaOptions = Array.from(viaSelect.selectedOptions).filter(option => option.value !== "");
    if (selectedViaOptions.length === 0) {
        markFieldInvalid('viaSelect', true);
        alertMessage += "- Via Haltestelle(n) muss/müssen ausgewählt werden.\n";
        isValid = false;
    }
    if (includeGong && selectedGong === "") {
        markFieldInvalid('gongSelect', true);
        alertMessage += "- Gong ist ausgewählt, aber kein Gong gewählt.\n";
        isValid = false;
    }

    if (!isValid) {
        showMessageBox(alertMessage);
        return;
    }

    const urls = [];
    if (includeGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    }

    const selectedLines = Array.from(lineSelect.selectedOptions).map(option => option.value).filter(value => value !== "");
    if (selectedLines.length > 0) {
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
        selectedLines.forEach((line, index) => {
            urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3");
            if (index < selectedLines.length - 1) {
                urls.push(GITHUB_BASE + "Fragmente/und.mp3");
            }
        });
    } else {
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    urls.push(GITHUB_BASE + "Fragmente/ueber.mp3");
    selectedViaOptions.forEach((option, index) => {
        urls.push(GITHUB_BASE + "via/" + encodeURIComponent(option.value));
        if (index < selectedViaOptions.length - 1) {
            urls.push(GITHUB_BASE + "Fragmente/und.mp3");
        }
    });
    downloadAudioSequence(urls, 'via_ansage.wav');
}

function downloadOnlyGong() {
    const selectedGong = document.getElementById("gongSelect").value;
    markFieldInvalid('gongSelect', false);

    if (selectedGong === "") {
        showMessageBox("- Gong muss ausgewählt werden, um nur Gong herunterzuladen.");
        markFieldInvalid('gongSelect', true);
        return;
    }

    const gongUrl = GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong);
    downloadAudioSequence([gongUrl], 'gong.wav');
}

function downloadOnlyLine() {
    const lineSelect = document.getElementById("lineSelect");
    const selectedLines = Array.from(lineSelect.selectedOptions).map(option => option.value).filter(value => value !== "");
    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    markFieldInvalid('lineSelect', false);
    markFieldInvalid('gongSelect', false);

    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    if (selectedLines.length === 0) {
        markFieldInvalid('lineSelect', true);
        alertMessage += "- Liniennummer(n) muss/müssen ausgewählt werden.\n";
        isValid = false;
    }
    if (includeGong && selectedGong === "") {
        markFieldInvalid('gongSelect', true);
        alertMessage += "- Gong ist ausgewählt, aber kein Gong gewählt.\n";
        isValid = false;
    }

    if (!isValid) {
        showMessageBox(alertMessage);
        return;
    }

    const urls = [];
    if (includeGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    }

    urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
    selectedLines.forEach((line, index) => {
        urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3");
        if (index < selectedLines.length - 1) {
            urls.push(GITHUB_BASE + "Fragmente/und.mp3");
        }
    });
    downloadAudioSequence(urls, 'linienansage.wav');
}


// Event-Listener für die Buttons
document.getElementById("playBtn").addEventListener("click", playAnnouncement);
document.getElementById("downloadBtn").addEventListener("click", downloadFullAnnouncement);

document.getElementById("sonderPlayBtn").addEventListener("click", playOnlySonderansage);
document.getElementById("sonderDownloadBtn").addEventListener("click", downloadOnlySonderansage);

document.getElementById("viaPlayBtn").addEventListener("click", playOnlyVia);
document.getElementById("viaDownloadBtn").addEventListener("click", downloadOnlyVia);

document.getElementById("gongPlayBtn").addEventListener("click", playOnlyGong);
document.getElementById("gongDownloadBtn").addEventListener("click", downloadOnlyGong);

document.getElementById("linePlayBtn").addEventListener("click", playOnlyLine);
document.getElementById("lineDownloadBtn").addEventListener("click", downloadOnlyLine);


// Dropdowns laden, Nummernliste laden und Listener einrichten, sobald das DOM bereit ist
document.addEventListener("DOMContentLoaded", () => {
    loadDropdowns();
});
