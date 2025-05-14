const GITHUB_BASE = "https://raw.githubusercontent.com/jakobneukirchner/ext_webapp_bsvg/main/";

async function loadOptions() {
    const zielApi = "https://api.github.com/repos/jakobneukirchner/ext_webapp_bsvg/contents/Ziele";
    const viaApi = "https://api.github.com/repos/jakobneukirchner/ext_webapp_bsvg/contents/via";
    const sonderApi = "https://api.github.com/repos/jakobneukirchner/ext_webapp_bsvg/contents/Hinweise";

    const zielSelect = document.getElementById("zielSelect");
    const viaSelect = document.getElementById("viaSelect");
    const sonderSelect = document.getElementById("sonderSelect");

    const zielData = await fetch(zielApi).then(res => res.json());
    zielData.forEach(file => {
        if (file.name.endsWith(".mp3")) {
            const name = decodeURIComponent(file.name.replace(".mp3", ""));
            zielSelect.add(new Option(name, name));
        }
    });

    const viaData = await fetch(viaApi).then(res => res.json());
    viaData.forEach(file => {
        if (file.name.endsWith(".mp3")) {
            const name = decodeURIComponent(file.name.replace(".mp3", ""));
            viaSelect.add(new Option(name, name));
        }
    });

    const sonderData = await fetch(sonderApi).then(res => res.json());
    sonderData.forEach(file => {
        if (file.name.endsWith(".mp3")) {
            const name = decodeURIComponent(file.name.replace(".mp3", ""));
            sonderSelect.add(new Option(name, name));
        }
    });
}

function playSequence(urls) {
    if (urls.length === 0) return;
    const audio = new Audio(urls[0]);
    audio.play();
    audio.onended = () => playSequence(urls.slice(1));
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

    if (via) {
        urls.push(GITHUB_BASE + "Fragmente/über.mp3");
        urls.push(GITHUB_BASE + "via/" + encodeURIComponent(via) + ".mp3");
    }

    if (sonder) {
        urls.push(GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder) + ".mp3");
    }

    playSequence(urls);
}

function playOnlySonderansage() {
    const sonder = document.getElementById("sonderSelect").value;
    if (!sonder) return;
    const url = GITHUB_BASE + "Hinweise/" + encodeURIComponent(sonder) + ".mp3";
    playSequence([url]);
}

loadOptions();
