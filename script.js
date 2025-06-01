/**
 * Hauptkonfigurationsbasis für den Zugriff auf Audio-Dateien im GitHub-Repository.
 * Alle Pfade zu den Audio-Fragmenten werden relativ zu dieser Basis-URL aufgebaut.
 */
const GITHUB_BASE = "https://raw.githubusercontent.com/jakobneukirchner/ext_webapp_bsvg/main/";

// =================================================================================================
// GLOBALE VARIABLEN FÜR DIE AUDIO-WIEDERGABE-STEUERUNG
// Diese Variablen verwalten den Zustand der aktuell abgespielten Ansage.
// =================================================================================================

/**
 * @type {AudioContext|null} audioContext - Die zentrale Instanz der Web Audio API.
 * Wird verwendet, um Audio zu dekodieren, zu verarbeiten und abzuspielen.
 */
let audioContext = null;

/**
 * @type {Map<string, AudioBuffer>} preloadedAudioBuffers - Ein Map-Objekt, das AudioBuffers speichert.
 * Schlüssel ist die URL des Audio-Fragments, Wert ist der dekodierte AudioBuffer.
 * Dient als Cache für die flüssige Wiedergabe.
 */
let preloadedAudioBuffers = new Map();

/**
 * @type {AudioBufferSourceNode[]} activeSources - Ein Array, das alle aktuell aktiven AudioBufferSourceNodes speichert.
 * Dies ist wichtig, um die Wiedergabe bei Bedarf stoppen zu können.
 */
let activeSources = [];

/**
 * @type {string[]} availableLineNumberFiles - Eine globale Liste der verfügbaren Liniennummern (ohne .mp3-Endung).
 * Wird beim Laden der Dropdowns befüllt und für die Validierung der Liniennummern verwendet.
 * Beispiel: ["1", "2", "M1", "S3"]
 */
let availableLineNumberFiles = [];


// =================================================================================================
// FUNKTIONEN ZUR STEUERUNG DER AUDIO-WIEDERGABE (WEB AUDIO API)
// Diese Funktionen verwalten das Starten, Stoppen und den Fortschritt der Ansagen.
// =================================================================================================

/**
 * Initialisiert den Web Audio API Context.
 * Dies sollte so früh wie möglich geschehen, idealerweise nach einer ersten Benutzerinteraktion,
 * um Autoplay-Richtlinien der Browser zu erfüllen.
 */
function initializeAudioContext() {
    if (!audioContext) {
        // Erstellt einen neuen AudioContext, der für die Audio-Verarbeitung benötigt wird.
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("Web Audio Context initialisiert.");
    }
}

/**
 * Stoppt die aktuell laufende Audiowiedergabe sofort.
 * Beendet alle aktiven AudioBufferSourceNodes und leert die Liste der aktiven Quellen.
 */
function stopPlayback() {
    if (audioContext && activeSources.length > 0) {
        activeSources.forEach(source => {
            try {
                // Versucht, die Audioquelle zu stoppen. Ein Fehler kann auftreten,
                // wenn die Quelle bereits beendet oder gestoppt wurde.
                source.stop();
            } catch (e) {
                console.warn("Fehler beim Stoppen der Audioquelle (möglicherweise bereits beendet):", e);
            }
        });
        // Die Liste der aktiven Quellen leeren
        activeSources = [];
    }
    console.log("Wiedergabe gestoppt.");
}

/**
 * Lädt alle Audio-Dateien von den gegebenen URLs in AudioBuffers vor.
 * Diese werden im `preloadedAudioBuffers`-Map gespeichert, um eine schnelle und flüssige Wiedergabe zu ermöglichen.
 * @param {string[]} urls - Ein Array von URLs zu den Audio-Dateien, die vorgeladen werden sollen.
 * @returns {Promise<void>} Ein Promise, das aufgelöst wird, wenn alle Audio-Dateien erfolgreich vorgeladen wurden.
 */
async function preloadAudioUrls(urls) {
    initializeAudioContext(); // Sicherstellen, dass der AudioContext initialisiert ist
    preloadedAudioBuffers.clear(); // Den vorherigen Cache leeren

    // Zeige den Ladebalken an
    showMessageBox("Audio wird vorgeladen... Bitte warten.", true);

    const fetchAndDecodePromises = urls.map(async url => {
        // Ungültige oder leere URLs überspringen
        if (!url || typeof url !== 'string' || url.trim() === '') {
            console.warn(`Ungültige URL beim Vorladen übersprungen: ${url}`);
            return null; // Null zurückgeben, um anzuzeigen, dass dieser Eintrag übersprungen wurde
        }
        // Wenn die Datei bereits im Cache ist, den vorhandenen Buffer zurückgeben
        if (preloadedAudioBuffers.has(url)) {
            return preloadedAudioBuffers.get(url);
        }
        try {
            // Audio-Datei abrufen
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP-Fehler! Status: ${response.status} für ${url}`);
            }
            const arrayBuffer = await response.arrayBuffer(); // Rohdaten als ArrayBuffer
            // Audio-Daten dekodieren
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            // Den dekodierten Buffer im Cache speichern
            preloadedAudioBuffers.set(url, audioBuffer);
            return audioBuffer;
        } catch (error) {
            console.error(`Fehler beim Vorladen von Audio von ${url}:`, error);
            return null; // Null zurückgeben bei Fehler
        }
    });

    // Warten, bis alle Promises abgeschlossen sind, und fehlgeschlagene Ergebnisse filtern
    const results = await Promise.all(fetchAndDecodePromises);
    // Den `preloadedAudioBuffers`-Map mit den erfolgreich geladenen Buffern aktualisieren
    // Filtert alle `null`-Werte heraus, die von fehlgeschlagenen Downloads stammen könnten.
    preloadedAudioBuffers = new Map(
        results.filter(buffer => buffer !== null).map(buffer => {
            // Finde die ursprüngliche URL für den erfolgreich geladenen Buffer
            // Dies ist notwendig, da `results` nur die Buffer enthält, nicht die URLs.
            const url = urls.find(u => preloadedAudioBuffers.get(u) === buffer);
            return [url, buffer];
        })
    );

    // Verstecke den Ladebalken, aber zeige eine kurze Erfolgsmeldung, die sich selbst schließt
    showMessageBox(`Vorladen abgeschlossen. ${preloadedAudioBuffers.size} Dateien erfolgreich geladen.`, false);
    setTimeout(() => {
        const msgBox = document.getElementById('customMessageBox');
        if (msgBox) msgBox.style.display = 'none';
    }, 1500); // Meldung nach 1.5 Sekunden ausblenden

    console.log(`Vorladen abgeschlossen. ${preloadedAudioBuffers.size} Dateien erfolgreich geladen.`);
}


/**
 * Spielt eine Sequenz von Audio-Buffern nahtlos hintereinander ab, indem die Web Audio API verwendet wird.
 * Diese Funktion sorgt für eine flüssige Wiedergabe ohne hörbare Lücken oder Überschneidungen.
 * @param {string[]} urls - Ein Array von URLs, die die Reihenfolge der abzuspielenden Audio-Fragmente darstellen.
 */
async function playSeamlessSequence(urls) {
    stopPlayback(); // Zuerst jegliche laufende Wiedergabe stoppen

    initializeAudioContext(); // Sicherstellen, dass der AudioContext bereit ist

    // Alle benötigten Audio-Dateien vorladen, bevor die Wiedergabe beginnt
    // Der Ladebalken wird bereits von preloadAudioUrls gesteuert.
    await preloadAudioUrls(urls);

    activeSources = []; // Liste der aktiven Quellen für die neue Sequenz leeren
    let currentTime = audioContext.currentTime; // Startzeit für das erste Audio-Fragment

    // Iteriere durch die URLs, um die Audio-Buffer abzuspielen
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const audioBuffer = preloadedAudioBuffers.get(url);

        if (!audioBuffer) {
            console.warn(`Überspringe fehlenden oder fehlerhaften Audio-Buffer für URL: ${url}`);
            continue; // Dieses Fragment überspringen und mit dem nächsten fortfahren
        }

        // Einen neuen AudioBufferSourceNode erstellen
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer; // Den vorgeladenen AudioBuffer zuweisen

        // Den Source Node direkt an das AudioContext-Ziel (Lautsprecher) anschliessen.
        // Die Web Audio API handhabt Mono-zu-Stereo-Konvertierung automatisch,
        // wenn ein Mono-Source an ein Stereo-Destination angeschlossen wird.
        source.connect(audioContext.destination);

        // Wiedergabe des Audio-Fragments zu einem präzisen Zeitpunkt planen
        source.start(currentTime);
        activeSources.push(source); // Die Quelle verfolgen, um sie später stoppen zu können

        // Die Startzeit für das nächste Audio-Fragment aktualisieren
        currentTime += audioBuffer.duration;

        // Wenn dies das letzte Audio-Fragment in der Sequenz ist, einen Event-Listener für das Ende hinzufügen
        if (i === urls.length - 1) {
            source.onended = () => {
                console.log("Nahtlose Audiosequenz vollständig beendet.");
                activeSources = []; // Alle aktiven Quellen löschen, da die Sequenz beendet ist
            };
        }
    }

    // Wenn nach dem Durchlauf keine Quellen geplant wurden (z.B. alle URLs waren ungültig)
    if (activeSources.length === 0) {
        console.warn("Es wurden keine Audioquellen für die Wiedergabe geplant.");
    }
}


// =================================================================================================
// FORMULAR-VALIDIERUNG UND UI-MANIPULATION
// Funktionen zur Überprüfung der Benutzereingaben und zur visuellen Rückmeldung.
// =================================================================================================

/**
 * Überprüft, ob eine gegebene Liniennummer in der Liste der verfügbaren Dateien existiert.
 * Diese Funktion ist für die Validierung der Eingabe im Liniennummer-Dropdown gedacht.
 * @param {string} lineNumber - Die zu validierende Liniennummer (z.B. "4", "M1").
 * @returns {boolean} True, wenn die Liniennummer gültig ist oder leer (was als "keine Linie gewählt" interpretiert wird),
 * andernfalls False.
 */
function isValidLineNumber(lineNumber) {
    // Eine leere Liniennummer wird als gültig betrachtet, da sie optional ist.
    if (!lineNumber || lineNumber.trim() === "") {
        return true;
    }
    // Überprüfen, ob die bereinigte Liniennummer in der Liste der verfügbaren Dateien enthalten ist.
    return availableLineNumberFiles.includes(lineNumber.trim());
}

/**
 * Markiert ein Formularfeld visuell als ungültig oder entfernt diese Markierung.
 * Fügt die Klasse "is-invalid" hinzu oder entfernt sie.
 * @param {string} elementId - Die ID des HTML-Elements, das markiert werden soll (z.B. "zielSelect").
 * @param {boolean} isInvalid - True, um als ungültig zu markieren, False, um die Markierung zu entfernen.
 */
function markFieldInvalid(elementId, isInvalid) {
    // Das HTML-Element anhand seiner ID abrufen
    const element = document.getElementById(elementId);
    // Überprüfen, ob das Element existiert
    if (element) {
        if (isInvalid) {
            // Klasse hinzufügen, um das Feld als ungültig zu kennzeichnen (z.B. rote Umrandung)
            element.classList.add("is-invalid");
        } else {
            // Klasse entfernen, um die Markierung zu entfernen
            element.classList.remove("is-invalid");
        }
    } else {
        // Konsolenwarnung, falls das Element nicht gefunden wurde (hilfreich beim Debugging)
        console.warn(`Element mit ID "${elementId}" zum Markieren nicht gefunden.`);
    }
}


// =================================================================================================
// BENUTZERDEFINIERTE MULTI-SELECT-DROPDOWNS
// Implementierung für Dropdowns mit Checkboxen für verbesserte mobile Nutzung.
// =================================================================================================

/**
 * Erstellt und verwaltet ein benutzerdefiniertes Multi-Select-Dropdown mit Checkboxen.
 * Dies ersetzt die nativen `<select multiple>`-Elemente für eine bessere UI/UX,
 * insbesondere auf Mobiltelefonen.
 *
 * @param {string} containerId - Die ID des Hauptcontainers für das benutzerdefinierte Select (z.B. 'lineSelectContainer').
 * @param {string} buttonId - Die ID des Buttons, der das Dropdown öffnet/schließt (z.B. 'lineSelectButton').
 * @param {string} dropdownId - Die ID des Dropdown-Containers, der die Checkbox-Optionen enthält (z.B. 'lineSelectDropdown').
 * @param {string[]} options - Ein Array von Strings, die die verfügbaren Optionen darstellen (z.B. ['1', '2', 'M3']).
 * @param {string} defaultText - Der Text, der auf dem Button angezeigt wird, wenn keine Option ausgewählt ist (z.B. '– Keine Linie wählen –').
 * @param {function} onSelectionChange - Eine Callback-Funktion, die bei jeder Änderung der Auswahl aufgerufen wird.
 * Sie erhält das Array der aktuell ausgewählten Werte als Argument.
 */
function createMultiSelectDropdown(containerId, buttonId, dropdownId, options, defaultText, onSelectionChange) {
    // Referenzen zu den DOM-Elementen abrufen
    const container = document.getElementById(containerId);
    const button = document.getElementById(buttonId);
    const dropdown = document.getElementById(dropdownId);
    // Das Span-Element im Button, das den ausgewählten Text anzeigt
    const buttonTextSpan = button.querySelector('span:first-child');
    // Ein Array, das die aktuell ausgewählten Werte speichert
    let selectedValues = [];

    // Sicherstellen, dass die DOM-Elemente existieren
    if (!container || !button || !dropdown || !buttonTextSpan) {
        console.error(`Fehler: Eines der erforderlichen Elemente für das Multi-Select-Dropdown (IDs: ${containerId}, ${buttonId}, ${dropdownId}) wurde nicht gefunden.`);
        return; // Funktion abbrechen, wenn Elemente fehlen
    }

    // Den Dropdown-Inhalt leeren, um Duplikate bei erneuter Initialisierung zu vermeiden
    dropdown.innerHTML = '';
    // Für jede Option im `options`-Array eine Checkbox erstellen
    options.forEach(optionValue => {
        // Label-Element für die Checkbox erstellen (für bessere Klickbarkeit)
        const label = document.createElement('label');
        label.className = 'checkbox-option'; // CSS-Klasse für Styling
        // Checkbox-Input-Element erstellen
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; // Typ: Checkbox
        checkbox.value = optionValue; // Der Wert der Checkbox
        // Event-Listener für Änderungen an der Checkbox
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                // Wenn die Checkbox aktiviert ist und der Wert noch nicht ausgewählt wurde, hinzufügen
                if (!selectedValues.includes(optionValue)) {
                    selectedValues.push(optionValue);
                }
            } else {
                // Wenn die Checkbox deaktiviert ist, den Wert aus der Liste entfernen
                selectedValues = selectedValues.filter(val => val !== optionValue);
            }
            // Den Text des Buttons aktualisieren, um die aktuelle Auswahl widerzuspiegeln
            updateButtonText();
            // Die Callback-Funktion mit den aktualisierten ausgewählten Werten aufrufen
            onSelectionChange(selectedValues);
        });
        // Checkbox und Text zum Label hinzufügen
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(optionValue));
        // Das Label zum Dropdown-Container hinzufügen
        dropdown.appendChild(label);
    });

    /**
     * Aktualisiert den Text, der auf dem Haupt-Button des Dropdowns angezeigt wird.
     * Zeigt entweder den Standardtext, den einzelnen ausgewählten Wert oder die Anzahl der ausgewählten Werte an.
     */
    function updateButtonText() {
        if (selectedValues.length === 0) {
            buttonTextSpan.textContent = defaultText; // Keine Auswahl
        } else if (selectedValues.length === 1) {
            buttonTextSpan.textContent = selectedValues[0]; // Einzelne Auswahl
        } else {
            buttonTextSpan.textContent = `${selectedValues.length} ausgewählt`; // Mehrere Auswahl
        }
        // Die "is-invalid"-Markierung wird hier NICHT gesetzt, um zu verhindern,
        // dass Felder beim Laden der Seite bereits als falsch markiert sind.
        // Die Validierung erfolgt erst beim Versuch, eine Ansage zu generieren.
    }

    // Event-Listener für den Haupt-Button des Dropdowns (zum Umschalten der Sichtbarkeit)
    button.addEventListener('click', (event) => {
        event.stopPropagation(); // Verhindert, dass das Klick-Event an das Dokument weitergegeben wird (wichtig für das Schließen des Dropdowns)
        dropdown.classList.toggle('show'); // Schaltet die CSS-Klasse 'show' um, um das Dropdown anzuzeigen/verstecken
        button.classList.toggle('active'); // Fügt eine Klasse für den aktiven Zustand des Buttons hinzu (für Styling)
    });

    // Event-Listener auf dem gesamten Dokument, um das Dropdown zu schließen, wenn außerhalb geklickt wird
    document.addEventListener('click', (event) => {
        if (!container.contains(event.target)) {
            dropdown.classList.remove('show'); // Dropdown verstecken
            button.classList.remove('active'); // Aktiven Zustand des Buttons entfernen
        }
    });

    // Den initialen Text des Buttons beim Laden setzen
    updateButtonText();

    // Eine Methode zum Abrufen der aktuell ausgewählten Werte am Container-Element anhängen.
    // Dies ermöglicht anderen Teilen des Skripts, die Auswahl einfach abzufragen.
    container.getSelectedValues = () => selectedValues;
}


// =================================================================================================
// LADEN VON DROPDOWN-OPTIONEN AUS DEM GITHUB-REPOSITORY
// Funktionen zum Abrufen und Befüllen der Select- und Custom-Dropdowns.
// =================================================================================================

/**
 * Lädt die Optionen für alle Dropdown-Menüs (Ziel, Via, Sonderansagen, Gong, Liniennummern)
 * aus dem konfigurierten GitHub-Repository.
 * Diese Funktion wird beim Laden der Seite ausgeführt.
 */
async function loadDropdowns() {
    // Referenzen zu den Standard-Select-Elementen abrufen
    const zielSelect = document.getElementById("zielSelect");
    const sonderSelect = document.getElementById("sonderSelect");
    const gongSelect = document.getElementById("gongSelect");

    // Sicherstellen, dass die Standard-Select-Elemente existieren
    if (!zielSelect || !sonderSelect || !gongSelect) {
        console.error("Fehler: Eines der Standard-Select-Elemente (Ziel, Sonder, Gong) wurde nicht gefunden.");
        return;
    }

    // Leeren der Standard-Dropdowns, um alte Optionen zu entfernen (außer der ersten "Bitte wählen"-Option)
    while (zielSelect.options.length > 1) zielSelect.remove(1);
    while (sonderSelect.options.length > 1) sonderSelect.remove(1);
    while (gongSelect.options.length > 1) gongSelect.remove(1);
    // Die globale Liste der verfügbaren Liniennummern zurücksetzen
    availableLineNumberFiles = [];

    /**
     * Hilfsfunktion zum Abrufen einer Liste von .mp3-Dateinamen aus einem spezifischen GitHub-Pfad.
     * @param {string} path - Der relative Pfad zum Ordner im GitHub-Repository (z.B. "Ziele", "via").
     * @returns {Promise<string[]>} Ein Promise, das ein Array von Dateinamen (z.B. ["Datei.mp3"]) zurückgibt,
     * oder ein leeres Array im Fehlerfall.
     */
    async function fetchMp3Filenames(path) {
        console.log(`Versuche Dateien von ${path} zu laden...`);
        try {
            // API-Aufruf an GitHub, um den Inhalt des angegebenen Pfades abzurufen
            const response = await fetch(`https://api.github.com/repos/jakobneukirchner/ext_webapp_bsvg/contents/${path}`);

            // Überprüfen, ob der API-Aufruf erfolgreich war
            if (!response.ok) {
                console.warn(`Konnte Daten für ${path} nicht laden (Status: ${response.status}).`);
                // Spezielle Behandlung für 404 (Not Found), was bedeuten könnte, dass der Ordner leer ist oder nicht existiert
                if (response.status === 404) {
                    console.warn(`Pfad nicht gefunden oder leer: ${path}. Dies ist möglicherweise beabsichtigt, wenn keine Dateien erwartet werden.`);
                    return []; // Leeres Array zurückgeben, wenn der Pfad nicht gefunden wird
                }
                // Für andere HTTP-Fehler eine Ausnahme werfen
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Die JSON-Antwort parsen, die eine Liste von Dateien und Ordnern enthält
            const files = await response.json();
            // Filtern nach Dateien, die auf ".mp3" enden, und nur deren Namen zurückgeben
            const mp3Files = files
                .filter(file => file.type === 'file' && file.name.endsWith(".mp3"))
                .map(file => file.name);

            // Konsolenausgabe basierend auf dem Ergebnis des Ladens
            if (mp3Files.length === 0) {
                console.warn(`Keine .mp3 Dateien im Ordner ${path} gefunden.`);
            } else {
                console.log(`Erfolgreich ${mp3Files.length} .mp3 Dateien von ${path} geladen.`);
            }
            return mp3Files;

        } catch (error) {
            // Fehlerbehandlung für Netzwerkfehler oder andere Probleme beim Fetch
            console.error(`Netzwerk- oder anderer Fehler beim Laden von ${path}:`, error);
            return []; // Bei jedem Fehler ein leeres Array zurückgeben
        }
    }

    console.log("Starte das Laden der Dropdowns und der Nummern-Dateiliste...");
    // Laden Sie alle erforderlichen Datenquellen parallel mit Promise.all, um die Ladezeit zu optimieren.
    const [zielFiles, viaFiles, sonderFiles, gongFiles, numberFiles] = await Promise.all([
        fetchMp3Filenames("Ziele"), // Zieldateien
        fetchMp3Filenames("via"),   // Via-Dateien
        fetchMp3Filenames("Hinweise"), // Sonderansagen-Dateien
        fetchMp3Filenames("gong"),   // Gong-Dateien
        fetchMp3Filenames("Nummern/line_number_end") // Liniennummer-Dateien für Validierung
    ]);

    // Befüllen der Standard-Dropdown-Menüs
    // `decodeURIComponent` wird verwendet, um URL-kodierte Zeichen (z.B. %C3%BC für ü) in lesbaren Text umzuwandeln.
    // `.replace(".mp3", "")` entfernt die Dateiendung für die Anzeige im Dropdown.
    zielSelect.add(new Option('– Bitte wählen –', '')); // Standard-Option hinzufügen
    zielFiles.forEach(name => zielSelect.add(new Option(decodeURIComponent(name.replace(".mp3", "")), name)));

    sonderSelect.add(new Option('– Keine Sonderansage –', '')); // Standard-Option hinzufügen
    sonderFiles.forEach(name => sonderSelect.add(new Option(decodeURIComponent(name.replace(".mp3", "")), name)));

    gongSelect.add(new Option('– Keinen Gong wählen –', '')); // Standard-Option hinzufügen
    gongFiles.forEach(name => gongSelect.add(new Option(decodeURIComponent(name.replace(".mp3", "")), name)));

    // Speichern der reinen Liniennummern (ohne .mp3-Endung) in der globalen Variable für die Validierung.
    availableLineNumberFiles = numberFiles.map(name => name.replace(".mp3", ""));
    console.log("Verfügbare Liniennummer-Dateien für Validierung:", availableLineNumberFiles);

    // Initialisieren der benutzerdefinierten Multi-Select-Dropdowns
    // Für Liniennummern:
    createMultiSelectDropdown(
        'lineSelectContainer',      // ID des Containers
        'lineSelectButton',         // ID des Buttons
        'lineSelectDropdown',       // ID des Dropdown-Inhalts
        availableLineNumberFiles,   // Optionen sind die geladenen Liniennummern
        '– Keine Linie wählen –',   // Standardtext
        (selected) => {             // Callback bei Auswahländerung
            console.log("Linien ausgewählt:", selected);
            markFieldInvalid('lineSelectContainer', false); // Fehlermarkierung entfernen
        }
    );

    // Für Via-Haltestellen:
    // Hier wird der Dateiname ohne .mp3 für die Anzeige im Dropdown verwendet, aber die volle URL wird später generiert.
    const viaOptionsForDropdown = viaFiles.map(name => decodeURIComponent(name.replace(".mp3", "")));
    createMultiSelectDropdown(
        'viaSelectContainer',       // ID des Containers
        'viaSelectButton',          // ID des Buttons
        'viaSelectDropdown',        // ID des Dropdown-Inhalts
        viaOptionsForDropdown,      // Optionen sind die geladenen Via-Haltestellen
        '– Keine Via –',            // Standardtext
        (selected) => {             // Callback bei Auswahländerung
            console.log("Via ausgewählt:", selected);
            markFieldInvalid('viaSelectContainer', false); // Fehlermarkierung entfernen
        }
    );

    console.log("Alle Dropdowns und Nummernliste erfolgreich geladen und initialisiert.");

    // Event-Listener für die Gong-Checkbox einrichten
    setupGongCheckboxListener();
    // Event-Listener für die anderen Formularfelder einrichten
    setupFormFieldListeners();
}


// =================================================================================================
// FORMULAR-EVENT-LISTENER UND HILFSFUNKTIONEN
// Funktionen zur Interaktion mit den Formularfeldern und zur Steuerung der UI.
// =================================================================================================

/**
 * Richtet den Event-Listener für die Gong-Checkbox ein.
 * Steuert die Sichtbarkeit des Gong-Auswahl-Dropdowns basierend auf dem Status der Checkbox.
 */
function setupGongCheckboxListener() {
    // Referenzen zu den DOM-Elementen abrufen
    const checkbox = document.getElementById("includeGongCheckbox");
    const container = document.getElementById("gongSelectContainer");
    const gongSelect = document.getElementById("gongSelect");

    // Sicherstellen, dass alle Elemente vorhanden sind
    if (checkbox && container && gongSelect) {
        // Event-Listener für Änderungen am Checkbox-Status
        checkbox.addEventListener('change', function() {
            // Überprüfen, ob Gong-Dateien überhaupt verfügbar sind (mehr als die Standardoption)
            const gongsAvailable = gongSelect.options.length > 1;
            if (this.checked) { // Wenn die Checkbox aktiviert ist
                if (gongsAvailable) {
                    container.style.display = 'flex'; // Gong-Dropdown anzeigen
                } else {
                    // Wenn keine Gongs verfügbar sind, Checkbox deaktivieren und Fehlermeldung anzeigen
                    console.warn("Gong-Checkbox angehakt, aber keine Gong-Dateien verfügbar. Option wird deaktiviert.");
                    this.checked = false; // Checkbox zurücksetzen
                    showMessageBox("Es wurden keine Gong-Dateien gefunden oder geladen. Die Option wird deaktiviert.");
                    container.style.display = 'none'; // Gong-Dropdown verstecken
                }
            } else { // Wenn die Checkbox deaktiviert ist
                container.style.display = 'none'; // Gong-Dropdown verstecken
                gongSelect.value = ""; // Auswahl zurücksetzen
                markFieldInvalid('gongSelect', false); // Fehlermarkierung entfernen
            }
        });
        // Initial das Gong-Dropdown verstecken
        container.style.display = 'none';
    } else {
        console.error("Gong Checkbox, Container oder Select nicht gefunden! Überprüfen Sie die HTML-IDs.");
    }
}

/**
 * Richtet Event-Listener für die Standard-Formularfelder ein.
 * Entfernt die "is-invalid"-Markierung, sobald der Benutzer mit dem Feld interagiert.
 */
function setupFormFieldListeners() {
    // Referenzen zu den Standard-Select-Elementen abrufen
    const zielSelect = document.getElementById("zielSelect");
    const sonderSelect = document.getElementById("sonderSelect");
    const gongSelect = document.getElementById("gongSelect");

    // Für jedes Standard-Select-Feld Listener hinzufügen, um Fehlermarkierungen zu entfernen
    if (zielSelect) {
        zielSelect.addEventListener('change', () => markFieldInvalid('zielSelect', false));
        zielSelect.addEventListener('focus', () => markFieldInvalid('zielSelect', false));
    } else console.error("Ziel-Select nicht gefunden für Listener-Setup!");

    if (sonderSelect) {
        sonderSelect.addEventListener('change', () => markFieldInvalid('sonderSelect', false));
        sonderSelect.addEventListener('focus', () => markFieldInvalid('sonderSelect', false));
    } else console.error("Sonder-Select nicht gefunden für Listener-Setup!");

    if (gongSelect) {
        gongSelect.addEventListener('change', () => markFieldInvalid('gongSelect', false));
        gongSelect.addEventListener('focus', () => markFieldInvalid('gongSelect', false));
    } else console.error("Gong-Select nicht gefunden für Listener-Setup!");

    // Die benutzerdefinierten Multi-Select-Dropdowns (lineSelectContainer, viaSelectContainer)
    // haben ihre eigenen Listener, die bereits in `createMultiSelectDropdown` eingerichtet werden.
    // Daher müssen hier keine zusätzlichen Listener für sie hinzugefügt werden.
}


// =================================================================================================
// ANSAGE-URL-GENERIERUNG
// Die Kernlogik zum Zusammenstellen der Audio-Fragment-URLs basierend auf der Benutzerauswahl.
// =================================================================================================

/**
 * Generiert ein Array von URLs für die vollständige Ansage basierend auf den aktuellen Formularfeldern.
 * Diese Funktion ist zentral und wird sowohl für die Wiedergabe als auch für den Download verwendet.
 * @returns {string[]} Ein Array von Strings, wobei jeder String eine vollständige URL zu einem Audio-Fragment ist.
 * Gibt ein leeres Array zurück, wenn Validierungsfehler auftreten.
 */
function generateAnnouncementUrls() {
    // Ausgewählte Werte von den benutzerdefinierten Multi-Select-Dropdowns abrufen
    const lineSelectContainer = document.getElementById("lineSelectContainer");
    const selectedLines = lineSelectContainer.getSelectedValues();
    
    const ziel = document.getElementById("zielSelect").value; // Wert vom Standard-Select
    
    const viaSelectContainer = document.getElementById("viaSelectContainer");
    const selectedViaOptions = viaSelectContainer.getSelectedValues();
    
    const sonder = document.getElementById("sonderSelect").value; // Wert vom Standard-Select

    // Status der Gong-Checkbox und des ausgewählten Gongs abrufen
    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    // Zu Beginn alle vorherigen Fehlermarkierungen entfernen, um einen sauberen Validierungsdurchlauf zu starten
    markFieldInvalid('lineSelectContainer', false);
    markFieldInvalid('zielSelect', false);
    markFieldInvalid('viaSelectContainer', false);
    markFieldInvalid('sonderSelect', false);
    markFieldInvalid('gongSelect', false);

    // --- START DER FORMULAR-VALIDIERUNG ---
    let isValid = true; // Flag, das auf false gesetzt wird, wenn ein Fehler gefunden wird
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n"; // Sammelt Fehlermeldungen

    // Validierung: Fahrziel ist obligatorisch
    if (ziel === "") {
        markFieldInvalid('zielSelect', true); // Feld als ungültig markieren
        alertMessage += "- Fahrziel muss ausgewählt werden.\n";
        isValid = false;
    }

    // Validierung: Wenn Gong aktiviert ist, muss ein Gong ausgewählt sein
    if (includeGong && selectedGong === "") {
        markFieldInvalid('gongSelect', true); // Feld als ungültig markieren
        alertMessage += "- Gong ist ausgewählt, aber kein Gong gewählt.\n";
        isValid = false;
    }

    // Wenn Validierungsfehler aufgetreten sind, Meldung anzeigen und leeres Array zurückgeben
    if (!isValid) {
        showMessageBox(alertMessage); // Benutzerdefinierte Meldungsbox anzeigen
        console.warn("Ansage abgebrochen: Validierungsfehler sind aufgetreten.");
        return []; // Leeres Array signalisiert, dass keine gültigen URLs generiert werden konnten
    }
    // --- ENDE DER FORMULAR-VALIDIERUNG ---

    // Array zum Speichern der generierten Audio-Fragment-URLs
    const urls = [];

    // 0. Gong (optional): Wird zuerst hinzugefügt, wenn ausgewählt
    if (includeGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    }

    // 1. Liniennummern oder "Zug": Logik für die Linienansage
    if (selectedLines.length > 0) {
        // Wenn Liniennummern ausgewählt sind, füge das Fragment "Linie" hinzu
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
        // Iteriere über alle ausgewählten Liniennummern
        selectedLines.forEach((line, index) => {
            // Füge die URL für die spezifische Liniennummer hinzu
            urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3");
            // Füge "und" nur vor der letzten Liniennummer hinzu, wenn mehr als eine ausgewählt ist
            if (selectedLines.length > 1 && index === selectedLines.length - 2) {
                urls.push(GITHUB_BASE + "Fragmente/und.mp3");
            }
        });
    } else {
        // Wenn keine Liniennummern ausgewählt sind, füge das Fragment "Zug" hinzu
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    // 2. Ziel (obligatorisch): Füge die Fragmente für "nach" und das Ziel hinzu
    urls.push(GITHUB_BASE + "Fragmente/nach.mp3");
    urls.push(GITHUB_BASE + "Ziele/" + encodeURIComponent(ziel));

    // 3. Via (optional): Logik für Via-Haltestellen
    if (selectedViaOptions.length > 0) {
        urls.push(GITHUB_BASE + "Fragmente/ueber.mp3");
        // Iteriere über alle ausgewählten Via-Haltestellen
        selectedViaOptions.forEach((option, index) => {
            // Hier ist es wichtig, die .mp3-Endung wieder hinzuzufügen, da getSelectedValues() nur den Namen ohne Endung liefert
            urls.push(GITHUB_BASE + "via/" + encodeURIComponent(option + ".mp3"));
            // Füge "und" nur vor der letzten Via-Haltestelle hinzu, wenn mehr als eine ausgewählt ist
            if (selectedViaOptions.length > 1 && index === selectedViaOptions.length - 2) {
                urls.push(GITHUB_BASE + "Fragmente/und.mp3");
            }
        });
    }

    // 4. Sonderansage (optional): Füge die Sonderansage hinzu, wenn ausgewählt
    if (sonder && sonder !== "") {
        urls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder));
    }

    // Das final generierte Array von URLs zurückgeben
    return urls;
}


// =================================================================================================
// WIEDERGABE-FUNKTIONEN FÜR VERSCHIEDENE ANSAGE-TYPEN
// Diese Funktionen rufen `generateAnnouncementUrls` auf und starten die Wiedergabe.
// =================================================================================================

/**
 * Spielt die vollständige Ansage ab, indem alle relevanten Audio-Fragmente kombiniert werden.
 * Ruft `generateAnnouncementUrls()` auf, um die Liste der URLs zu erhalten.
 */
function playAnnouncement() {
    // Die URLs für die vollständige Ansage generieren
    const urls = generateAnnouncementUrls();
    // Überprüfen, ob URLs generiert wurden (d.h., keine Validierungsfehler)
    if (urls.length > 0) {
        console.log("Konstruierte URLs für die vollständige Ansage zur Wiedergabe:", urls);
        playSeamlessSequence(urls); // Die Wiedergabe über die Web Audio API starten
    } else {
        console.warn("Keine URLs zum Abspielen konstruiert. Überprüfen Sie die Formulareingaben und Validierung.");
    }
}

/**
 * Spielt nur die ausgewählte Sonderansage ab, optional mit Gong.
 * Führt eine eigene Validierung für die Sonderansage durch.
 */
function playOnlySonderansage() {
    // Werte für Sonderansage und Gong abrufen
    const sonder = document.getElementById("sonderSelect").value;
    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    // Fehlermarkierungen zurücksetzen
    markFieldInvalid('sonderSelect', false);
    markFieldInvalid('gongSelect', false);

    // Eigene Validierung für diese spezifische Wiedergabe
    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    if (sonder === "") {
        markFieldInvalid('sonderSelect', true);
        alertMessage += "- Sonderansage muss ausgewählt werden, um sie abzuspielen.\n";
        isValid = false;
    }

    if (includeGong && selectedGong === "") {
        markFieldInvalid('gongSelect', true);
        alertMessage += "- Gong ist ausgewählt, aber kein Gong gewählt.\n";
        isValid = false;
    }

    if (!isValid) {
        showMessageBox(alertMessage);
        console.warn("'Nur Sonderansage' Wiedergabe abgebrochen: Validierungsfehler.");
        return;
    }

    // URLs für die Sonderansage-Sequenz generieren
    const urls = [];
    if (includeGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    }
    urls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder));

    console.log("Konstruierte URLs für 'Nur Sonderansage' zur Wiedergabe:", urls);
    playSeamlessSequence(urls); // Wiedergabe starten
}

/**
 * Spielt nur die Via-Ansage ab, optional mit Gong und Liniennummer/Zug.
 * Führt eine eigene Validierung für Via-Haltestellen durch.
 */
function playOnlyVia() {
    // Werte von den benutzerdefinierten Multi-Selects und Standard-Selects abrufen
    const lineSelectContainer = document.getElementById("lineSelectContainer");
    const selectedLines = lineSelectContainer.getSelectedValues();
    const viaSelectContainer = document.getElementById("viaSelectContainer");
    const selectedViaOptions = viaSelectContainer.getSelectedValues();
    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    // Fehlermarkierungen zurücksetzen
    markFieldInvalid('lineSelectContainer', false);
    markFieldInvalid('viaSelectContainer', false);
    markFieldInvalid('gongSelect', false);

    // Eigene Validierung für diese spezifische Wiedergabe
    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    if (selectedViaOptions.length === 0) {
        markFieldInvalid('viaSelectContainer', true);
        alertMessage += "- Via Haltestelle(n) muss/müssen ausgewählt werden, um sie abzuspielen.\n";
        isValid = false;
    }

    if (includeGong && selectedGong === "") {
        markFieldInvalid('gongSelect', true);
        alertMessage += "- Gong ist ausgewählt, aber kein Gong gewählt.\n";
        isValid = false;
    }

    if (!isValid) {
        showMessageBox(alertMessage);
        console.warn("'Nur Via' Ansage Wiedergabe abgebrochen: Validierungsfehler.");
        return;
    }

    // URLs für die Via-Ansage-Sequenz generieren
    const urls = [];
    if (includeGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    }

    // Liniennummern-Logik (wie in generateAnnouncementUrls)
    if (selectedLines.length > 0) {
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
        selectedLines.forEach((line, index) => {
            urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3");
            if (selectedLines.length > 1 && index === selectedLines.length - 2) {
                urls.push(GITHUB_BASE + "Fragmente/und.mp3");
            }
        });
    } else {
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    urls.push(GITHUB_BASE + "Fragmente/ueber.mp3");
    selectedViaOptions.forEach((option, index) => {
        urls.push(GITHUB_BASE + "via/" + encodeURIComponent(option + ".mp3"));
        if (selectedViaOptions.length > 1 && index === selectedViaOptions.length - 2) {
            urls.push(GITHUB_BASE + "Fragmente/und.mp3");
        }
    });

    console.log("Konstruierte URLs für 'Nur Via' zur Wiedergabe:", urls);
    playSeamlessSequence(urls); // Wiedergabe starten
}

/**
 * Spielt nur den ausgewählten Gong ab.
 * Führt eine eigene Validierung für den Gong durch.
 */
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
        console.warn("'Nur Gong' Wiedergabe abgebrochen: Validierungsfehler.");
        return;
    }

    const gongUrl = GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong);
    console.log("Spiele nur Gong ab:", gongUrl);
    playSeamlessSequence([gongUrl]); // Nur den Gong abspielen
}

/**
 * Spielt nur die ausgewählten Liniennummern ab, optional mit Gong.
 * Führt eine eigene Validierung für Liniennummern durch.
 */
function playOnlyLine() {
    // Werte von den benutzerdefinierten Multi-Selects und Standard-Selects abrufen
    const lineSelectContainer = document.getElementById("lineSelectContainer");
    const selectedLines = lineSelectContainer.getSelectedValues();
    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    // Fehlermarkierungen zurücksetzen
    markFieldInvalid('lineSelectContainer', false);
    markFieldInvalid('gongSelect', false);

    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    if (selectedLines.length === 0) {
        markFieldInvalid('lineSelectContainer', true);
        alertMessage += "- Liniennummer(n) muss/müssen ausgewählt werden, um sie abzuspielen.\n";
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
        if (selectedLines.length > 1 && index === selectedLines.length - 2) {
            urls.push(GITHUB_BASE + "Fragmente/und.mp3");
        }
    });
    console.log("Konstruierte URLs für 'Nur Linie(n)' zur Wiedergabe:", urls);
    playSeamlessSequence(urls); // Wiedergabe starten
}


// =================================================================================================
// BENUTZERDEFINIERTE NACHRICHTENBOX (MODAL)
// Ersetzt Standard-Alerts für eine bessere Benutzererfahrung.
// =================================================================================================

/**
 * Zeigt ein benutzerdefiniertes Modal (Nachrichtenbox) anstelle des nativen `alert()`.
 * Dies bietet eine konsistentere und anpassbarere Benutzeroberfläche.
 * @param {string} message - Die Nachricht, die im Modal angezeigt werden soll.
 * @param {boolean} showSpinner - Ob ein Lade-Spinner angezeigt werden soll (Standard: false).
 */
function showMessageBox(message, showSpinner = false) {
    const modalId = 'customMessageBox';
    let modal = document.getElementById(modalId);
    let spinner = document.getElementById('loadingSpinner'); // Referenz zum Spinner-Element

    // Wenn das Modal noch nicht existiert, erstellen Sie es und fügen Sie es dem DOM hinzu
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'message-box-overlay'; // CSS-Klasse für das Overlay
        // Der HTML-Inhalt des Modals, inklusive des Spinners
        modal.innerHTML = `
            <div class="message-box-content">
                <p id="messageBoxText"></p>
                <div id="loadingSpinner" class="spinner" style="display: none;"></div>
                <button id="messageBoxCloseBtn">OK</button>
            </div>
        `;
        document.body.appendChild(modal);

        // Nach dem Hinzufügen zum DOM die Referenz zum Spinner aktualisieren
        spinner = document.getElementById('loadingSpinner');

        // Event-Listener für den Schliessen-Button des Modals
        document.getElementById('messageBoxCloseBtn').addEventListener('click', () => {
            modal.style.display = 'none'; // Modal verstecken
            // Sicherstellen, dass der Spinner auch versteckt wird, wenn das Modal manuell geschlossen wird
            if (spinner) spinner.style.display = 'none';
        });
    }

    // Den Nachrichtentext im Modal aktualisieren
    document.getElementById('messageBoxText').innerText = message;

    // Spinner-Sichtbarkeit steuern
    if (spinner) {
        spinner.style.display = showSpinner ? 'block' : 'none';
    }

    // Den OK-Button verstecken, wenn ein Spinner angezeigt wird (da der Vorgang noch läuft)
    const closeBtn = document.getElementById('messageBoxCloseBtn');
    if (closeBtn) {
        closeBtn.style.display = showSpinner ? 'none' : 'block';
    }

    // Das Modal anzeigen (Flexbox für Zentrierung)
    modal.style.display = 'flex';
}


// =================================================================================================
// DOWNLOAD-FUNKTIONEN FÜR AUDIO-SEQUENZEN
// Ermöglicht das Herunterladen der generierten Ansagen als WAV-Datei.
// =================================================================================================

/**
 * Lädt alle Audiofragmente, kombiniert sie zu einer einzigen WAV-Datei und bietet diese zum Download an.
 * Nutzt die Web Audio API für die Dekodierung und Kombination der Audio-Buffer.
 * @param {string[]} urlsToDownload - Ein Array von URLs der Audiofragmente, die heruntergeladen werden sollen.
 * @param {string} filename - Der gewünschte Dateiname für die heruntergeladene WAV-Datei (Standard: 'ansage.wav').
 */
async function downloadAudioSequence(urlsToDownload, filename = 'ansage.wav') {
    // Überprüfen, ob URLs zum Herunterladen vorhanden sind
    if (urlsToDownload.length === 0) {
        showMessageBox("Es wurden keine Audio-URLs generiert, um sie herunterzuladen. Bitte überprüfen Sie Ihre Auswahl.");
        return;
    }

    try {
        // Nachricht anzeigen, dass der Download vorbereitet wird, mit Spinner
        showMessageBox("Ansage wird vorbereitet zum Download... Dies kann einen Moment dauern. Bitte warten.", true);

        initializeAudioContext(); // Sicherstellen, dass der AudioContext initialisiert ist

        const audioBuffers = []; // Array zum Speichern der dekodierten AudioBuffer
        let totalLength = 0; // Gesamtlänge aller Audio-Buffer in Samples

        // Jeden Audio-URL einzeln abrufen und dekodieren
        for (const url of urlsToDownload) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP-Fehler beim Laden von ${url}: ${response.statusText} (Status: ${response.status})`);
                }
                const arrayBuffer = await response.arrayBuffer(); // Rohdaten als ArrayBuffer
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer); // Audio dekodieren
                audioBuffers.push(audioBuffer); // Zum Array hinzufügen
                totalLength += audioBuffer.length; // Gesamtlänge aktualisieren
            } catch (error) {
                console.error(`Fehler beim Laden/Dekodieren von Audio-Fragment ${url}:`, error);
                // Das fehlerhafte Fragment überspringen und mit dem nächsten fortfahren
                // Eine Fehlermeldung für den Benutzer könnte hier ebenfalls angezeigt werden.
            }
        }

        // Überprüfen, ob nach dem Laden gültige Audio-Buffer vorhanden sind
        if (audioBuffers.length === 0) {
            showMessageBox("Keine gültigen Audio-Dateien zum Kombinieren gefunden. Der Download wurde abgebrochen.");
            return;
        }

        // Einen neuen AudioBuffer für die kombinierte Ausgabe erstellen
        // WICHTIG: Erzeuge immer einen Stereo-Buffer (2 Kanäle) für den Download
        const outputBuffer = audioContext.createBuffer(
            2, // Erzwinge 2 Kanäle für Stereo-Ausgabe
            totalLength,                      // Gesamtlänge in Samples
            audioContext.sampleRate           // Abtastrate
        );

        let offset = 0; // Offset für das Einfügen der einzelne Buffer in den Ausgabe-Buffer
        // Jeden dekodierten Audio-Buffer in den Ausgabe-Buffer kopieren
        for (const buffer of audioBuffers) {
            // Kopiere Daten von jedem Kanal des Quell-Buffers in die entsprechenden Kanäle des Ziel-Buffers
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                // Wenn der Quell-Buffer mono ist (1 Kanal), kopiere ihn auf beide Kanäle des Ziel-Buffers
                if (buffer.numberOfChannels === 1) {
                    outputBuffer.getChannelData(0).set(buffer.getChannelData(0), offset); // Linker Kanal
                    outputBuffer.getChannelData(1).set(buffer.getChannelData(0), offset); // Rechter Kanal (Duplikat)
                } else {
                    // Wenn der Quell-Buffer Stereo ist, kopiere die Kanäle direkt
                    outputBuffer.getChannelData(i).set(buffer.getChannelData(i), offset);
                }
            }
            offset += buffer.length; // Offset für das nächste Fragment aktualisieren
        }

        // Den kombinierten AudioBuffer in ein WAV-Blob-Format konvertieren
        const wavBlob = audioBufferToWav(outputBuffer);

        // Einen temporären URL für den Blob erstellen und einen Download-Link simulieren
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a'); // Ein temporäres Anker-Element erstellen
        a.href = url; // Die Blob-URL als href setzen
        a.download = filename; // Den gewünschten Dateinamen setzen
        document.body.appendChild(a); // Das Element dem DOM hinzufügen (kurzzeitig)
        a.click(); // Einen Klick simulieren, um den Download auszulösen
        document.body.removeChild(a); // Das temporäre Element wieder entfernen
        URL.revokeObjectURL(url); // Den temporären URL freigeben, um Speicher zu sparen

        // Erfolgsmeldung anzeigen und Spinner verstecken
        showMessageBox("Ansage erfolgreich heruntergeladen!", false);
        setTimeout(() => {
            const msgBox = document.getElementById('customMessageBox');
            if (msgBox) msgBox.style.display = 'none';
        }, 1500); // Meldung nach 1.5 Sekunden ausblenden

    } catch (error) {
        console.error("Fehler beim Herunterladen der Ansage:", error);
        showMessageBox("Fehler beim Herunterladen der Ansage: " + error.message + ". Bitte versuchen Sie es erneut.", false);
    }
}

/**
 * Konvertiert einen Web Audio API AudioBuffer in einen WAV-Blob.
 * Diese Funktion wurde angepasst, um immer eine Stereo-WAV-Datei zu erzeugen,
 * selbst wenn der Eingangs-AudioBuffer mono ist.
 * @param {AudioBuffer} buffer - Der zu konvertierende AudioBuffer.
 * @returns {Blob} Der resultierende WAV-Blob.
 */
function audioBufferToWav(buffer) {
    const desiredNumChannels = 2; // Wir wollen immer Stereo-Ausgabe
    const inputNumChannels = buffer.numberOfChannels; // Kanäle des Quell-Buffers
    const sampleRate = buffer.sampleRate;
    const bitsPerSample = 16; // Feste Bit-Tiefe für PCM

    // Berechne die Gesamtlänge des WAV-Dateipuffers basierend auf der gewünschten Stereo-Ausgabe
    const totalSamples = buffer.length; // Länge pro Kanal (in Samples)
    const btwLength = totalSamples * desiredNumChannels * (bitsPerSample / 8) + 44; // 44 Bytes für den WAV-Header

    const buf = new ArrayBuffer(btwLength);
    const view = new DataView(buf);
    let offset = 0;

    /** Hilfsfunktion zum Schreiben eines Strings in den DataView. */
    const writeString = (str) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    /** Hilfsfunktion zum Schreiben eines 16-Bit Unsigned Integer in den DataView. */
    const writeUint16 = (val) => {
        view.setUint16(offset, val, true); // true für Little-Endian
        offset += 2;
    };

    /** Hilfsfunktion zum Schreiben eines 32-Bit Unsigned Integer in den DataView. */
    const writeUint32 = (val) => {
        view.setUint32(offset, val, true); // true für Little-Endian
        offset += 4;
    };

    // --- WAV-Header schreiben ---

    // RIFF-Chunk
    writeString('RIFF'); offset += 4;
    writeUint32(btwLength - 8); // ChunkSize
    writeString('WAVE'); offset += 4;

    // fmt-Subchunk (Format-Chunk)
    writeString('fmt '); offset += 4;
    writeUint32(16); // Subchunk1Size (16 für PCM)
    writeUint16(1); // AudioFormat (1 für PCM)
    writeUint16(desiredNumChannels); // NumChannels (ERZWINGE STEREO)
    writeUint32(sampleRate); // SampleRate
    writeUint32(sampleRate * desiredNumChannels * (bitsPerSample / 8)); // ByteRate
    writeUint16(desiredNumChannels * (bitsPerSample / 8)); // BlockAlign
    writeUint16(bitsPerSample); // BitsPerSample

    // data-Subchunk (Daten-Chunk)
    writeString('data'); offset += 4;
    writeUint32(totalSamples * desiredNumChannels * (bitsPerSample / 8)); // Data chunk length

    // Kanal-Daten aus dem Quell-Buffer abrufen
    const inputChannels = [];
    for (let i = 0; i < inputNumChannels; i++) {
        inputChannels.push(buffer.getChannelData(i));
    }

    // Samples interleaven (für Stereo: LRLR...) und als 16-Bit PCM schreiben
    for (let i = 0; i < totalSamples; i++) {
        for (let j = 0; j < desiredNumChannels; j++) {
            let sample;
            if (inputNumChannels === 1) {
                // Wenn der Quell-Buffer mono ist, verwende den einzigen Kanal für beide Stereo-Kanäle
                sample = inputChannels[0][i];
            } else {
                // Wenn der Quell-Buffer bereits Stereo oder mehr ist, verwende den entsprechenden Kanal
                sample = inputChannels[j % inputNumChannels][i]; // Sicherstellen, dass der Index gültig ist
            }

            // Sample-Wert normalisieren (-1.0 bis 1.0) und in 16-Bit Integer konvertieren
            sample = Math.max(-1, Math.min(1, sample)); // Auf den Bereich [-1, 1] begrenzen
            sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0; // Konvertierung zu 16-bit Integer
            view.setInt16(offset, sample, true); // Sample in den Buffer schreiben (Little-Endian)
            offset += 2; // Offset um 2 Bytes erhöhen (da 16-bit Sample)
        }
    }

    // Den fertigen ArrayBuffer als Blob zurückgeben
    return new Blob([buf], { type: 'audio/wav' });
}


// =================================================================================================
// DOWNLOAD-FUNKTIONEN FÜR SPEZIFISCHE ANSAGE-TYPEN
// Diese Funktionen generieren URLs und rufen `downloadAudioSequence` auf.
// =================================================================================================

/**
 * Löst den Download der vollständigen Ansage als WAV-Datei aus.
 * Nutzt `generateAnnouncementUrls()` um die zu kombinierenden Fragmente zu bestimmen.
 */
function downloadFullAnnouncement() {
    const urls = generateAnnouncementUrls(); // URLs generieren
    // Den Download-Vorgang starten
    downloadAudioSequence(urls, 'vollstaendige_ansage.wav');
}

/**
 * Löst den Download der Sonderansage (optional mit Gong) als WAV-Datei aus.
 * Führt eine eigene Validierung durch.
 */
function downloadOnlySonderansage() {
    // Werte abrufen
    const sonder = document.getElementById("sonderSelect").value;
    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    // Fehlermarkierungen zurücksetzen
    markFieldInvalid('sonderSelect', false);
    markFieldInvalid('gongSelect', false);

    // Validierung
    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    if (sonder === "") {
        markFieldInvalid('sonderSelect', true);
        alertMessage += "- Sonderansage muss ausgewählt werden, um sie herunterzuladen.\n";
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

    // URLs für den Download generieren
    const urls = [];
    if (includeGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    }
    urls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder));
    downloadAudioSequence(urls, 'sonderansage.wav');
}

/**
 * Löst den Download der Via-Ansage (optional mit Gong und Liniennummer/Zug) als WAV-Datei aus.
 * Führt eine eigene Validierung durch.
 */
function downloadOnlyVia() {
    // Werte abrufen
    const lineSelectContainer = document.getElementById("lineSelectContainer");
    const selectedLines = lineSelectContainer.getSelectedValues();
    const viaSelectContainer = document.getElementById("viaSelectContainer");
    const selectedViaOptions = viaSelectContainer.getSelectedValues();
    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    // Fehlermarkierungen zurücksetzen
    markFieldInvalid('lineSelectContainer', false);
    markFieldInvalid('viaSelectContainer', false);
    markFieldInvalid('gongSelect', false);

    // Validierung
    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    if (selectedViaOptions.length === 0) {
        markFieldInvalid('viaSelectContainer', true);
        alertMessage += "- Via Haltestelle(n) muss/müssen ausgewählt werden, um sie herunterzuladen.\n";
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

    // URLs für den Download generieren
    const urls = [];
    if (includeGong && selectedGong !== "") {
        urls.push(GITHUB_BASE + "gong/" + encodeURIComponent(selectedGong));
    }

    // Liniennummern-Logik für Download
    if (selectedLines.length > 0) {
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
        selectedLines.forEach((line, index) => {
            urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3");
            // "und" nur vor der letzten Liniennummer
            if (selectedLines.length > 1 && index === selectedLines.length - 2) {
                urls.push(GITHUB_BASE + "Fragmente/und.mp3");
            }
        });
    } else {
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    urls.push(GITHUB_BASE + "Fragmente/ueber.mp3");
    selectedViaOptions.forEach((option, index) => {
        urls.push(GITHUB_BASE + "via/" + encodeURIComponent(option + ".mp3"));
        // "und" nur vor der letzten Via-Haltestelle
        if (selectedViaOptions.length > 1 && index === selectedViaOptions.length - 2) {
            urls.push(GITHUB_BASE + "Fragmente/und.mp3");
        }
    });
    downloadAudioSequence(urls, 'via_ansage.wav');
}

/**
 * Löst den Download des ausgewählten Gongs als WAV-Datei aus.
 * Führt eine eigene Validierung durch.
 */
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

/**
 * Löst den Download der Linienansage (optional mit Gong) als WAV-Datei aus.
 * Führt eine eigene Validierung durch.
 */
function downloadOnlyLine() {
    // Werte abrufen
    const lineSelectContainer = document.getElementById("lineSelectContainer");
    const selectedLines = lineSelectContainer.getSelectedValues();
    const includeGong = document.getElementById("includeGongCheckbox").checked;
    const selectedGong = document.getElementById("gongSelect").value;

    // Fehlermarkierungen zurücksetzen
    markFieldInvalid('lineSelectContainer', false);
    markFieldInvalid('gongSelect', false);

    let isValid = true;
    let alertMessage = "Bitte korrigieren Sie folgende Eingaben:\n";

    if (selectedLines.length === 0) {
        markFieldInvalid('lineSelectContainer', true);
        alertMessage += "- Liniennummer(n) muss/müssen ausgewählt werden, um sie herunterzuladen.\n";
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
        if (selectedLines.length > 1 && index === selectedLines.length - 2) {
            urls.push(GITHUB_BASE + "Fragmente/und.mp3");
        }
    });
    downloadAudioSequence(urls, 'linienansage.wav');
}


// =================================================================================================
// INITIALISIERUNG UND EVENT-LISTENER FÜR BUTTONS
// Startet die Anwendung und bindet Klick-Events an die Buttons.
// =================================================================================================

// Event-Listener für den Haupt-Play-Button
document.getElementById("playBtn").addEventListener("click", playAnnouncement);
// Event-Listener für den Haupt-Download-Button
document.getElementById("downloadBtn").addEventListener("click", downloadFullAnnouncement);

// Event-Listener für die Sonderansage-Buttons
document.getElementById("sonderPlayBtn").addEventListener("click", playOnlySonderansage);
document.getElementById("sonderDownloadBtn").addEventListener("click", downloadOnlySonderansage);

// Event-Listener für die Via-Buttons
document.getElementById("viaPlayBtn").addEventListener("click", playOnlyVia);
document.getElementById("viaDownloadBtn").addEventListener("click", downloadOnlyVia);

// Event-Listener für die Gong-Buttons
document.getElementById("gongPlayBtn").addEventListener("click", playOnlyGong);
document.getElementById("gongDownloadBtn").addEventListener("click", downloadOnlyGong);

// Event-Listener für die Linien-Buttons
document.getElementById("linePlayBtn").addEventListener("click", playOnlyLine);
document.getElementById("lineDownloadBtn").addEventListener("click", downloadOnlyLine);


/**
 * Wird ausgeführt, sobald das gesamte DOM geladen und geparst wurde.
 * Startet den Ladevorgang für die Dropdown-Optionen.
 */
document.addEventListener("DOMContentLoaded", () => {
    // Initialisiert den AudioContext beim Laden des DOMs.
    // Dies ist eine gängige Praxis, um die Web Audio API vorzubereiten.
    initializeAudioContext();
    loadDropdowns();
});
