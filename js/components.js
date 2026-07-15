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

      const hasBack = this.hasAttribute("back-href");
      const href = this.getAttribute("back-href") || "index.html";
      const label = this.getAttribute("back-label") || "\u2190 Back";
      const backHtml = hasBack
        ? `<a class="back" href="${href}">${label}</a>`
        : `<span class="topbar__spacer" aria-hidden="true"></span>`;

      const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();
      const hash = (location.hash || "").toLowerCase();
      let section = "cover";
      if (file.startsWith("profile")) section = "profile";
      else if (file.startsWith("connect")) section = "connect";
      else if (file.startsWith("mini")) section = "mini";
      else if (file.startsWith("final")) section = "final";
      else if (
        file.startsWith("papers") ||
        file.startsWith("detect") ||
        file.startsWith("fuzz")
      ) {
        section = "paper";
      } else if (file.startsWith("works")) {
        if (hash.startsWith("#mini")) section = "mini";
        else if (hash.startsWith("#final")) section = "final";
        else if (hash.startsWith("#paper")) section = "paper";
        else section = "works";
      }

      const link = (id, href, label) => {
        const active = id === section;
        const cls = active ? ' class="is-active"' : "";
        const aria = active ? ' aria-current="page"' : "";
        return `<a href="${href}"${cls}${aria}>${label}</a>`;
      };

      const worksOpen = ["works", "paper", "mini", "final"].includes(section);
      const worksHeadCls = worksOpen ? ' class="nav-cluster__head is-active"' : ' class="nav-cluster__head"';

      const tabs = [
        link("cover", "index.html", "Cover"),
        link("profile", "profile.html", "Profile"),
        `<div class="nav-cluster${worksOpen ? " is-open" : ""}">
          <a href="works.html"${worksHeadCls}>Works</a>
          <div class="nav-cluster__sub" aria-label="Works sections">
            ${link("paper", "papers.html", "Paper")}
            ${link("mini", "mini1.html", "Mini")}
            ${link("final", "final1.html", "Final")}
          </div>
        </div>`,
        link("connect", "connect.html", "Connect"),
      ].join("");

      this.innerHTML = `<div class="topbar">${backHtml}<nav class="nav-tabs" aria-label="Sections">${tabs}</nav></div>`;
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