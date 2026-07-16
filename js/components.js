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

      const link = (id, href, label, extraClass = "") => {
        const active = id === section;
        const classes = [extraClass, active ? "is-active" : ""].filter(Boolean).join(" ");
        const cls = classes ? ` class="${classes}"` : "";
        const aria = active ? ' aria-current="page"' : "";
        return `<a href="${href}"${cls}${aria}>${label}</a>`;
      };

      const worksOpen = ["works", "paper", "mini", "final"].includes(section);
      const researchOpen = section === "paper";
      const rookiesOpen = section === "mini" || section === "final";
      const worksHeadCls = worksOpen ? ' class="nav-cluster__head is-active"' : ' class="nav-cluster__head"';
      const groupRow = (open) =>
        open
          ? ' class="nav-cluster__row nav-cluster__row--group is-active"'
          : ' class="nav-cluster__row nav-cluster__row--group"';

      const tabs = [
        link("cover", "index.html", "Cover"),
        link("profile", "profile.html", "Profile"),
        `<div class="nav-cluster${worksOpen ? " is-open" : ""}">
          <a href="works.html"${worksHeadCls}>Works</a>
          <div class="nav-cluster__sub" aria-label="Works sections">
            <div${groupRow(researchOpen)}>
              <span class="nav-cluster__group-label">Research</span>
              <span class="nav-cluster__sep" aria-hidden="true">—</span>
              ${link("paper", "papers.html", "Papers")}
            </div>
            <div${groupRow(rookiesOpen)}>
              <span class="nav-cluster__group-label">Rookies 5</span>
              <span class="nav-cluster__sep" aria-hidden="true">—</span>
              ${link("mini", "mini1.html", "Mini")}
              ${link("final", "final1.html", "Final")}
            </div>
          </div>
        </div>`,
        link("connect", "connect.html", "Connect"),
      ].join("");

      const drawerLinks = [
        link("cover", "index.html", "Cover", "nav-drawer__link"),
        link("profile", "profile.html", "Profile", "nav-drawer__link"),
        link("works", "works.html", "Works", "nav-drawer__link"),
        `<div class="nav-drawer__group">
          <p class="nav-drawer__group-label">Research <span aria-hidden="true">—</span></p>
          ${link("paper", "papers.html", "Papers", "nav-drawer__link nav-drawer__link--sub")}
        </div>`,
        `<div class="nav-drawer__group">
          <p class="nav-drawer__group-label">Rookies 5 <span aria-hidden="true">—</span></p>
          ${link("mini", "mini1.html", "Mini", "nav-drawer__link nav-drawer__link--sub")}
          ${link("final", "final1.html", "Final", "nav-drawer__link nav-drawer__link--sub")}
        </div>`,
        link("connect", "connect.html", "Connect", "nav-drawer__link"),
      ].join("");

      const drawerId = "site-nav-drawer";
      this.innerHTML = `
        <div class="topbar">
          ${backHtml}
          <nav class="nav-tabs" aria-label="Sections">${tabs}</nav>
          <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="${drawerId}" aria-label="메뉴 열기">
            <span class="nav-toggle__icon" aria-hidden="true"><span></span><span></span><span></span></span>
            <span class="nav-toggle__label">Menu</span>
          </button>
        </div>
        <button class="nav-drawer__backdrop" type="button" tabindex="-1" aria-label="메뉴 닫기" aria-hidden="true"></button>
        <aside class="nav-drawer" id="${drawerId}" aria-label="전체 메뉴" aria-hidden="true">
          <div class="nav-drawer__head">
            <p>Navigation</p>
            <button class="nav-drawer__close" type="button" aria-label="메뉴 닫기">×</button>
          </div>
          <nav class="nav-drawer__nav" aria-label="모바일 섹션 메뉴">${drawerLinks}</nav>
        </aside>`;

      const toggle = this.querySelector(".nav-toggle");
      const drawer = this.querySelector(".nav-drawer");
      const backdrop = this.querySelector(".nav-drawer__backdrop");
      const closeButton = this.querySelector(".nav-drawer__close");
      const desktopMedia = window.matchMedia("(min-width: 1101px)");
      let isOpen = false;

      const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

      const closeDrawer = (restoreFocus = true) => {
        if (!isOpen) return;
        isOpen = false;
        drawer.classList.remove("is-open");
        backdrop.classList.remove("is-visible");
        drawer.setAttribute("aria-hidden", "true");
        backdrop.setAttribute("aria-hidden", "true");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "메뉴 열기");
        document.documentElement.classList.remove("nav-drawer-open");
        if (restoreFocus) toggle.focus();
      };

      const openDrawer = () => {
        if (isOpen) return;
        isOpen = true;
        drawer.classList.add("is-open");
        backdrop.classList.add("is-visible");
        drawer.setAttribute("aria-hidden", "false");
        backdrop.setAttribute("aria-hidden", "false");
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "메뉴 닫기");
        document.documentElement.classList.add("nav-drawer-open");
        requestAnimationFrame(() => closeButton.focus());
      };

      toggle.addEventListener("click", () => (isOpen ? closeDrawer() : openDrawer()));
      closeButton.addEventListener("click", () => closeDrawer());
      backdrop.addEventListener("click", () => closeDrawer());
      drawer.querySelectorAll("a").forEach((item) => {
        item.addEventListener("click", () => closeDrawer(false));
      });

      this.addEventListener("keydown", (event) => {
        if (!isOpen) return;
        if (event.key === "Escape") {
          event.preventDefault();
          closeDrawer();
          return;
        }
        if (event.key !== "Tab") return;

        const focusable = [...drawer.querySelectorAll(focusableSelector)];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });

      desktopMedia.addEventListener("change", (event) => {
        if (event.matches) closeDrawer(false);
      });
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