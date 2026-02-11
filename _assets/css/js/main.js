// Typing effect
(function () {
    const el = document.querySelector("[data-typing]");
    if (!el) return;
  
    const text = el.getAttribute("data-typing") || "";
    let i = 0;
  
    function tick() {
      el.textContent = text.slice(0, i);
      i++;
      if (i <= text.length) setTimeout(tick, 25);
    }
    tick();
  })();
  
  // Project filtering
  (function () {
    const buttons = document.querySelectorAll("[data-filter]");
    const cards = document.querySelectorAll("[data-tags]");
    if (!buttons.length || !cards.length) return;
  
    function setActive(btn) {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    }
  
    function applyFilter(tag) {
      cards.forEach(card => {
        const tags = (card.getAttribute("data-tags") || "").split(",").map(s => s.trim());
        const show = tag === "All" || tags.includes(tag);
        card.style.display = show ? "" : "none";
      });
    }
  
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-filter");
        setActive(btn);
        applyFilter(tag);
      });
    });
  
    // default
    applyFilter("All");
  })();
  