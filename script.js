
const GITHUB_BASE = "https://raw.githubusercontent.com/jakobneukirchner/ext_webapp_bsvg/main/";

async function loadZiele() {
    const apiUrl = "https://api.github.com/repos/jakobneukirchner/ext_webapp_bsvg/contents/Ziele";
    const zielSelect = document.getElementById("zielSelect");
    const viaSelect = document.getElementById("viaSelect");

    const response = await fetch(apiUrl);
    const data = await response.json();

    data.forEach(file => {
        if (file.name.endsWith(".mp3")) {
            const name = decodeURIComponent(file.name.replace(".mp3", ""));
            const option1 = new Option(name, name);
            const option2 = new Option(name, name);
            zielSelect.add(option1);
            viaSelect.add(option2);
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
        urls.push(GITHUB_BASE + "Ziele/" + encodeURIComponent(via) + ".mp3");
    }

    playSequence(urls);
}

loadZiele();
