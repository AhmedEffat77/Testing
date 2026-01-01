const key = "wh_theme";
const root = document.documentElement;
const apply = (t) => root.setAttribute("data-theme", t);

const saved = localStorage.getItem(key) || "dark";
apply(saved);

document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "themeBtn") {
    const cur = root.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    apply(next);
    localStorage.setItem(key, next);
  }
});
