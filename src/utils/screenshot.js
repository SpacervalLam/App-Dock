export function startScreenshot() {
  return new Promise((resolve) => {
    // 取消主窗口穿透，让它接收鼠标事件
    window.electronAPI.enableInteraction();

    // 创建 overlay DOM
    const overlay = document.createElement("div");
    overlay.classList.add("screenshot-overlay");
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      background: "transparent",
      cursor: "crosshair",
      zIndex: "2000",
    });

    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, {
      width: "100%",
      height: "100%",
      display: "block",
    });
    overlay.appendChild(canvas);
    document.body.appendChild(overlay);

    // 初始化 canvas 尺寸和 context
    const c = canvas;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const ctx = c.getContext("2d");

    // 绘制半透明全屏遮罩
    function drawOverlay() {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(0, 0, c.width, c.height);
    }

    // 绘制选区：在遮罩上“挖空”并画边框
    function drawSelection(x, y, w, h) {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.clearRect(x, y, w, h);
      ctx.strokeStyle = "rgba(0, 180, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }

    // 鼠标事件处理
    let isSelecting = false;
    let startX = 0;
    let startY = 0;
    let justReleased = false;

    function onMouseDown(e) {
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;
      drawOverlay();
    }

    function onMouseMove(e) {
      if (!isSelecting) return;
      const currX = e.clientX;
      const currY = e.clientY;
      const x = Math.min(startX, currX);
      const y = Math.min(startY, currY);
      const w = Math.abs(currX - startX);
      const h = Math.abs(currY - startY);
      drawSelection(x, y, w, h);
    }

    function onMouseUp(e) {
      if (!isSelecting) return;
      isSelecting = false;
      justReleased = true;

      const endX = e.clientX;
      const endY = e.clientY;
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const w = Math.abs(endX - startX);
      const h = Math.abs(endY - startY);

      // 要把 CSS 像素坐标和当前视口大小都发给主进程
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      window.electronAPI.send("hide-main-and-capture", {
        x,
        y,
        width: w,
        height: h,
        viewportWidth,
        viewportHeight,
      });

      cleanup();
      resolve();
    }

    function onClick(e) {
      if (justReleased) {
        justReleased = false;
        return;
      }
      // 点击 overlay 但未框选，视作取消
      if (!isSelecting) {
        cleanup();
        resolve();
      }
    }

    function cleanup() {
      overlay.removeEventListener("mousedown", onMouseDown);
      overlay.removeEventListener("mousemove", onMouseMove);
      overlay.removeEventListener("mouseup", onMouseUp);
      overlay.removeEventListener("click", onClick);
      document.body.removeChild(overlay);
      // 主进程会在截图完成后再恢复主窗口透明穿透
    }

    // 注册事件并首次绘制遮罩
    overlay.addEventListener("mousedown", onMouseDown);
    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mouseup", onMouseUp);
    overlay.addEventListener("click", onClick);
    drawOverlay();
  });
}
