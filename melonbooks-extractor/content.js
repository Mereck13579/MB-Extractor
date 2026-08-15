(() => {
  "use strict";

  const cleanText = (value) =>
    (value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  function extractData() {
    const title =
      cleanText(document.querySelector(".item-page .item-header h1.page-header")?.textContent) ||
      cleanText(document.querySelector(".item-header h1.page-header")?.textContent);

    // Return only the number: no ¥ and no thousands separators.
    const priceRaw =
      document.querySelector(".item-page .item-meta3 .price .price--value")?.textContent ||
      document.querySelector(".price--value")?.textContent;

    const price = cleanText(priceRaw).replace(/[^\d]/g, "");

    let circleLink =
      document.querySelector(".item-page .item-header .author-name a") ||
      document.querySelector(".item-header .author-name a");

    if (!circleLink) {
      const rows = document.querySelectorAll(".item-page table tr");
      for (const row of rows) {
        const label = cleanText(row.querySelector("th")?.textContent);
        if (label === "サークル名") {
          circleLink = row.querySelector("td a[href*='/circle/']");
          if (circleLink) break;
        }
      }
    }

    const circleName = cleanText(circleLink?.textContent)
      .replace(/\s*\(作品数:\s*[\d,]+\)\s*$/, "");

    const circleUrl = circleLink
      ? new URL(circleLink.getAttribute("href"), "https://www.melonbooks.co.jp").href
      : "";

    return { title, price, circleName, circleUrl };
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      textarea.remove();
      return ok;
    }
  }

  function showStatus(message) {
    const status = document.querySelector("#mbe-status");
    if (!status) return;
    status.textContent = message;
    setTimeout(() => {
      status.textContent = "";
    }, 1500);
  }

  function updatePanel() {
    const data = extractData();

    const title = document.querySelector("#mbe-title");
    const price = document.querySelector("#mbe-price");
    const circle = document.querySelector("#mbe-circle");

    if (!title) return;

    title.textContent = data.title || "(not found)";
    price.textContent = data.price || "(not found)";
    circle.textContent = data.circleName || "(not found)";
    circle.href = data.circleUrl || "#";
    circle.style.pointerEvents = data.circleUrl ? "auto" : "none";
  }

  function createPanel() {
    if (document.getElementById("melonbooks-extractor-panel")) return;

    const panel = document.createElement("div");
    panel.id = "melonbooks-extractor-panel";

    panel.innerHTML = `
      <div class="mbe-header">
        <strong>Melonbooks Extractor</strong>
        <button type="button" id="mbe-minimize" title="Reduce">−</button>
      </div>

      <div class="mbe-body">
        <div class="mbe-row">
          <span class="mbe-label">Title</span>
          <span id="mbe-title" class="mbe-value"></span>
        </div>

        <div class="mbe-row">
          <span class="mbe-label">Price</span>
          <span id="mbe-price" class="mbe-value"></span>
        </div>

        <div class="mbe-row">
          <span class="mbe-label">Circle</span>
          <a id="mbe-circle" class="mbe-value" target="_blank" rel="noopener noreferrer"></a>
        </div>

        <div class="mbe-buttons">
          <button type="button" id="mbe-copy">Copy</button>
          <button type="button" id="mbe-copy-row">Copy row</button>
          <button type="button" id="mbe-refresh">Refresh</button>
        </div>

        <div id="mbe-status" class="mbe-status"></div>
      </div>

      <button type="button" id="mbe-restore" title="Open Melonbooks Extractor">🍈</button>
    `;

    document.body.appendChild(panel);

    panel.querySelector("#mbe-minimize").addEventListener("click", () => {
      panel.classList.add("mbe-minimized");
    });

    panel.querySelector("#mbe-restore").addEventListener("click", () => {
      panel.classList.remove("mbe-minimized");
    });

    panel.querySelector("#mbe-refresh").addEventListener("click", updatePanel);

    panel.querySelector("#mbe-copy").addEventListener("click", async () => {
      const data = extractData();

      const text =
        `Title: ${data.title}\n` +
        `Price: ${data.price}\n` +
        `Circle: ${data.circleName}\n` +
        `Circle URL: ${data.circleUrl}\n` +
        `Page URL: ${window.location.href}`;

      if (await copyText(text)) showStatus("Copied!");
      else showStatus("Copy failed");
    });

    // Copy a spreadsheet row using both plain TSV and HTML.
    // The HTML version makes the circle name itself a clickable hyperlink
    // when pasted into Excel / LibreOffice / Google Sheets.
    panel.querySelector("#mbe-copy-row").addEventListener("click", async () => {
      const data = extractData();

      const escapeHtml = (value) =>
        String(value || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

      const title = escapeHtml(data.title);
      const price = escapeHtml(data.price);
      const circleName = escapeHtml(data.circleName);
      const circleUrl = escapeHtml(data.circleUrl);
      const pageUrl = escapeHtml(window.location.href);

      // Plain-text fallback: still gives four spreadsheet columns.
      const textRow = [
        data.title,
        data.price,
        data.circleName,
        window.location.href
      ].join("\t");

      // HTML table: the third cell contains only the circle name as a link.
      const htmlRow =
        `<table><tr>` +
        `<td>${title}</td>` +
        `<td>${price}</td>` +
        `<td><a href="${circleUrl}">${circleName}</a></td>` +
        `<td>${pageUrl}</td>` +
        `</tr></table>`;

      try {
        if (navigator.clipboard && window.ClipboardItem) {
          const item = new ClipboardItem({
            "text/plain": new Blob([textRow], { type: "text/plain" }),
            "text/html": new Blob([htmlRow], { type: "text/html" })
          });
          await navigator.clipboard.write([item]);
          showStatus("Row copied!");
        } else {
          // Fallback for browsers without rich clipboard support.
          if (await copyText(textRow)) showStatus("Row copied!");
          else showStatus("Copy failed");
        }
      } catch {
        if (await copyText(textRow)) showStatus("Row copied!");
        else showStatus("Copy failed");
      }
    });

    updatePanel();
  }

  createPanel();
})();