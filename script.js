const GITHUB_BASE = "https://raw.githubusercontent.com/jakobneukirchner/ext_webapp_bsvg/main/";

async function loadDropdowns() {
    const zielSelect = document.getElementById("zielSelect");
    const viaSelect = document.getElementById("viaSelect");
    const sonderSelect = document.getElementById("sonderSelect");

    // Ziele laden
    const ziele = await fetch("https://api.github.com/repos/jakobneukirchner/ext_webapp_bsvg/contents/Ziele")
        .then(res => res.json());
    ziele.forEach(file => {
        if (file.name.endsWith(".mp3")) {
            const name = decodeURIComponent(file.name.replace(".mp3", ""));
            zielSelect.add(new Option(name, name));
        }
    });

    // Via laden (jetzt genauso wie Ziele behandeln)
    const vias = await fetch("https://api.github.com/repos/jakobneukirchner/ext_webapp_bsvg/contents/via")
        .then(res => res.json());
    vias.forEach(file => {
        if (file.name.endsWith(".mp3")) {
            const name = decodeURIComponent(file.name.replace(".mp3", ""));
            viaSelect.add(new Option(name, name));
        }
    });

    // Sonderansagen laden
    const sonder = await fetch("https://api.github.com/repos/jakobneukirchner/ext_webapp_bsvg/contents/Hinweise")
        .then(res => res.json());
    sonder.forEach(file => {
        if (file.name.endsWith(".mp3")) {
            const name = decodeURIComponent(file.name.replace(".mp3", ""));
            sonderSelect.add(new Option(name, name));
        }
    });
}

// Funktion zum Abspielen einer Sequenz von Audiodateien
function playSequence(urls, onComplete) {
    if (urls.length === 0) {
        if (onComplete) onComplete();
        return;
    }
    const audio = new Audio(urls[0]);
    audio.play();
    audio.onended = () => playSequence(urls.slice(1), onComplete);
}

// Funktion, um die vollständige Ansage abzuspielen
function playAnnouncement() {
    const line = document.getElementById("lineInput").value.trim();
    const ziel = document.getElementById("zielSelect").value;
    const via = document.getElementById("viaSelect").value;
    const sonder = document.getElementById("sonderSelect").value;

    const urls = [];

    if (line) {
        urls.push(GITHUB_BASE + "Fragmente/linie.mp3");
        urls.push(GITHUB_BASE + "Nummern/line_number_end/" + encodeURIComponent(line) + ".mp3");
    } else {
        urls.push(GITHUB_BASE + "Fragmente/zug.mp3");
    }

    urls.push(GITHUB_BASE + "Fragmente/nach.mp3");
    urls.push(GITHUB_BASE + "Ziele/" + encodeURIComponent(ziel) + ".mp3");

    playSequence(urls, () => {
        const viaUrls = [];
        if (via) {
            viaUrls.push(GITHUB_BASE + "Fragmente/über.mp3");
            viaUrls.push(GITHUB_BASE + "via/" + encodeURIComponent(via) + ".mp3");  // Behandle "via" wie "ziel"
        }
        playSequence(viaUrls, () => {
            const sonderUrls = [];
            if (sonder) {
                sonderUrls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder) + ".mp3");
            }
            playSequence(sonderUrls);
        });
    });
}

// Funktion, um nur die Sonderansage abzuspielen
function playOnlySonderansage() {
    const sonder = document.getElementById("sonderSelect").value;
    if (sonder) {
        const url = GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder) + ".mp3";
        playSequence([url]);
    }
}

// Funktion, um nur die Via-Ansage abzuspielen
function playOnlyVia() {
    const via = document.getElementById("viaSelect").value;
    if (via) {
        const viaUrls = [
            GITHUB_BASE + "Fragmente/über.mp3",
            GITHUB_BASE + "via/" + encodeURIComponent(via) + ".mp3"  // Behandle "via" wie "ziel"
        ];
        playSequence(viaUrls);
    } else {
        alert("Bitte wählen Sie eine Via-Haltestelle aus.");
    }
}

// Event-Listener für die Buttons
document.getElementById("playBtn").addEventListener("click", playAnnouncement);
document.getElementById("sonderBtn").addEventListener("click", playOnlySonderansage);
document.getElementById("viaBtn").addEventListener("click", playOnlyVia);

// Dropdowns laden (Ziele, Via, Sonderansagen)
loadDropdowns();
