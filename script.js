// --- Language toggle (EN text lives in the HTML, DE here) ---
const de = {
  "nav.about": "Über mich",
  "nav.experience": "Erfahrung",
  "nav.projects": "Projekte",
  "nav.contact": "Kontakt",
  "hero.where": "Dresden, Deutschland",
  "hero.role": "Visual Computing, 3D-Rekonstruktion und Simulation",
  "hero.lead": "Masterstudent in Computational Modeling and Simulation an der TU Dresden. Bei Fraunhofer IVI baue ich Simulationsumgebungen und Karten mit Unreal Engine und CARLA.",
  "hero.cta": "Projekte ansehen",
  "hero.cv": "Lebenslauf herunterladen",
  "about.text": "Ich studiere Computational Modeling and Simulation (M.Sc.) an der TU Dresden mit Schwerpunkt Visual Computing. Meine Arbeit liegt an der Schnittstelle von Computer Vision, Computergrafik und Simulation: Objekte aus Tast- und Bilddaten rekonstruieren, synthetische Daten für Perception erzeugen und virtuelle Testumgebungen aufbauen.",
  "about.edu": "Ausbildung",
  "about.focus": "Schwerpunkt Visual Computing",
  "about.expected": "(voraussichtlich)",
  "about.languages": "Sprachen",
  "about.tools": "Werkzeuge",
  "p1.meta": "Forschungsprojekt",
  "p1.text": "Rekonstruktion von Objektgeometrie durch die Kombination von Tastdaten des kamerabasierten Taktilsensors DIGIT mit visuellen Beobachtungen, mit NeMO für die 3D-Rekonstruktion.",
  "p1.report": "Projektbericht ↗",
  "p2.meta": "Formula-Student-Team ELBFLORACE",
  "p2.title": "Softwareingenieur für autonomes Fahren",
  "p2.dates": "Seit November 2025",
  "p2.text": "Arbeit an der Perception eines fahrerlosen Rennwagens auf Platz 5 der Formula-Student-Weltrangliste.",
  "p2.point1": "Aufbau einer BlenderProc-Pipeline, die annotierte synthetische Datensätze erzeugt und das YOLO-Training für Strecken- und Pylonenerkennung beschleunigt.",
  "p2.point2": "Digitale Zwillinge von Rennstrecken und Hindernissen in Blender, mit Python und C++, um die Perception unter wechselnden Bedingungen zu testen.",
  "exp.type": "Werkstudent",
  "exp.title": "Kartenerstellung und Simulationsentwicklung",
  "exp.dates": "Seit September 2026",
  "p3.text": "Aufbau von Simulationsumgebungen und Karten in Unreal Engine und CARLA für virtuelle Tests.",
  "p3.point1": "Aufbau fotorealistischer HD-Kartenumgebungen für CARLA – von vermessenen Straßendaten bis zur befahrbaren Simulation in Unreal Engine 4 mit ASAM OpenDRIVE.",
  "p3.point2": "Entwicklung einer Python-Toolchain zur Validierung und Reparatur von HD-Karten, die heute der Standard-Importschritt für neue Karten ist.",
  "p4.meta": "Forschungsprojekt",
  "p4.status": "Demnächst",
  "p4.title": "Echtzeit-Multi-View-Erfassung",
  "p4.text": "Evaluierung des aktuellen Stands der Technik bei der Echtzeit-Multi-View-Erfassung.",
  "contact.lead": "Ich spreche gerne über 3D-Vision, Simulation und synthetische Daten.",
  "contact.country": "Deutschland",
};

const i18nEls = document.querySelectorAll("[data-i18n]");
i18nEls.forEach((el) => (el.dataset.en = el.innerHTML));

function setLang(lang) {
  document.documentElement.lang = lang;
  i18nEls.forEach((el) => {
    const key = el.dataset.i18n;
    el.innerHTML = lang === "de" && de[key] ? de[key] : el.dataset.en;
  });
  document.querySelectorAll("[data-lang]").forEach((s) =>
    s.classList.toggle("active", s.dataset.lang === lang)
  );
  try { localStorage.setItem("lang", lang); } catch (e) {}
}

let saved = null;
try { saved = localStorage.getItem("lang"); } catch (e) {}
setLang(saved || (navigator.language.startsWith("de") ? "de" : "en"));

document.getElementById("lang-toggle").addEventListener("click", () =>
  setLang(document.documentElement.lang === "de" ? "en" : "de")
);


// --- Logo stripes follow the section in view ---
(() => {
  const stripes = document.querySelectorAll(".brand i");
  const links = document.querySelectorAll(".nav nav a[href^='#']");
  const sections = ["about", "experience", "projects", "contact"].map((id) => document.getElementById(id));

  function update() {
    // Active section: the last one whose top has passed the upper third of the viewport.
    // At the very bottom, contact wins even if it's too short to reach that line.
    const line = innerHeight / 3;
    let active = -1;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) active = i; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) active = sections.length - 1;
    stripes.forEach((el, i) => el.classList.toggle("on", active === -1 || i === active));
    links.forEach((a, i) => a.classList.toggle("active", i === active));
  }

  let queued = false;
  addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }, { passive: true });
  addEventListener("resize", update);
  update();
})();
