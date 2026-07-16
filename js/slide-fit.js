(() => {
  const frame = document.querySelector("[data-slide-fit]");
  if (!frame) return;

  const body = document.body;
  const baseWidth = Number(frame.dataset.fitWidth) || 1920;
  const baseHeight = Number(frame.dataset.fitHeight) || 913;
  const minWidth = Number(frame.dataset.fitMinWidth) || 1101;
  const minHeight = Number(frame.dataset.fitMinHeight) || 821;
  let resizeFrame = 0;

  function reset() {
    body.classList.remove("is-slide-fit-active");
    frame.style.removeProperty("width");
    frame.style.removeProperty("height");
    frame.style.removeProperty("left");
    frame.style.removeProperty("top");
    frame.style.removeProperty("transform");
  }

  function fit() {
    if (window.innerWidth < minWidth || window.innerHeight < minHeight) {
      reset();
      return;
    }

    const scale = Math.min(1, window.innerWidth / baseWidth, window.innerHeight / baseHeight);
    const visualWidth = baseWidth * scale;
    const visualHeight = baseHeight * scale;

    body.classList.add("is-slide-fit-active");
    frame.style.width = `${baseWidth}px`;
    frame.style.height = `${baseHeight}px`;
    frame.style.left = `${(window.innerWidth - visualWidth) / 2}px`;
    frame.style.top = `${(window.innerHeight - visualHeight) / 2}px`;
    frame.style.transform = `scale(${scale})`;
  }

  function scheduleFit() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(fit);
  }

  fit();
  window.addEventListener("resize", scheduleFit, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleFit, { passive: true });
})();
