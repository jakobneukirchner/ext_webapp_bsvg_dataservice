const GITHUB_BASE = "https://raw.githubusercontent.com/jakobneukirchner/ext_webapp_bsvg/main/";

async function loadDropdowns() {
    const zielSelect = document.getElementById("zielSelect");
    const viaSelect = document.getElementById("viaSelect");
    const sonderSelect = document.getElementById("sonderSelect");

    // Standardoptionen einfügen
    viaSelect.add(new Option("–", ""));
    sonderSelect.add(new Option("–", ""));

    // Ziele laden
    const ziele = await fetch("https://api.github.com/repos/jakobneukirchner/ext_webapp_bsvg/contents/Ziele")
        .then(res => res.json());
    ziele.forEach(file => {
        if (file.name.endsWith(".mp3")) {
            const name = decodeURIComponent(file.name.replace(".mp3", ""));
            zielSelect.add(new Option(name, name));
        }
    });

    // Via laden
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

function playSequence(urls, onComplete) {
    if (urls.length === 0) {
        if (onComplete) onComplete();
        return;
    }
    const audio = new Audio(urls[0]);
    audio.play();
    audio.onended = () => playSequence(urls.slice(1), onComplete);
}

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
        if (via && via !== "") {
            viaUrls.push(GITHUB_BASE + "Fragmente/über.mp3");
            viaUrls.push(GITHUB_BASE + "via/" + encodeURIComponent(via) + ".mp3");
        }
        playSequence(viaUrls, () => {
            const sonderUrls = [];
            if (sonder && sonder !== "") {
                sonderUrls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder) + ".mp3");
            }
            playSequence(sonderUrls);
        });
    });
}

function playOnlySonderansage() {
    const sonder = document.getElementById("sonderSelect").value;
    if (sonder && sonder !== "") {
        const url = GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder) + ".mp3";
        playSequence([url]);
    }
}

document.getElementById("playBtn").addEventListener("click", playAnnouncement);
document.getElementById("sonderBtn").addEventListener("click", playOnlySonderansage);

loadDropdowns();
