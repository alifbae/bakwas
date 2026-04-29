// Theme Management with Pico.css data-theme attribute
function toggleTheme() {
  const $html = $("html");
  const $icon = $(".theme-icon");

  const currentTheme = $html.attr("data-theme");

  if (currentTheme === "dark") {
    $html.attr("data-theme", "light");
    $icon.text("☾");
    localStorage.setItem("theme", "light");
  } else {
    $html.attr("data-theme", "dark");
    $icon.text("☼");
    localStorage.setItem("theme", "dark");
  }
}

// Load saved theme on page load
$(document).ready(function () {
  const savedTheme = localStorage.getItem("theme") || "dark";
  const $html = $("html");
  const $icon = $(".theme-icon");

  if (savedTheme === "light") {
    $html.attr("data-theme", "light");
    if ($icon.length) $icon.text("☾");
  } else {
    $html.attr("data-theme", "dark");
    if ($icon.length) $icon.text("☼");
  }
});
