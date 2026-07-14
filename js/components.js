(() => {
  const stackBaseFromDoc = () => {
    const root = document.documentElement;
    const custom =
      root.style.getPropertyValue("--stack-base").trim() ||
      getComputedStyle(root).getPropertyValue("--stack-base").trim();
    return (custom || "assets/stacks").replace(/\/$/, "");
  };

  class SiteNav extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = "1";
      const href = this.getAttribute("back-href") || "index.html";
      const label = this.getAttribute("back-label") || "\u2190 Back";
      this.innerHTML = `<div class="topbar"><a class="back" href="${href}">${label}</a></div>`;
    }
  }

  class SiteFooter extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = "1";
      const left = this.getAttribute("left");
      const nextHref = this.getAttribute("next-href");
      const nextLabel = this.getAttribute("next-label") || "Next \u2192";
      const align = this.getAttribute("align") || "between";

      let cls = "footer";
      if (align === "end") cls += " footer--end";
      if (align === "start") cls += " footer--start";

      const leftHtml = left ? `<p class="meta">${left}</p>` : "<span></span>";
      const nextHtml = nextHref
        ? `<a class="back" href="${nextHref}">${nextLabel}</a>`
        : "";

      this.innerHTML = `<footer class="${cls}">${leftHtml}${nextHtml}</footer>`;
    }
  }

  class TechBadge extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = "1";
      const icon = this.getAttribute("icon") || "";
      const label = this.getAttribute("label") || icon;
      const base = this.getAttribute("base") || stackBaseFromDoc();
      const src = icon ? `${base}/${icon}.png` : "";
      const img = src ? `<img src="${src}" alt="" />` : "";
      this.classList.add("tech");
      this.innerHTML = `${img}${label}`;
    }
  }

  if (!customElements.get("site-nav")) customElements.define("site-nav", SiteNav);
  if (!customElements.get("site-footer")) customElements.define("site-footer", SiteFooter);
  if (!customElements.get("tech-badge")) customElements.define("tech-badge", TechBadge);
})();