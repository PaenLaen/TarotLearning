(function () {
  "use strict";

  var SUIT_ORDER = ["major", "wands", "cups", "swords", "pentacles"];
  var SUIT_LABEL = {
    major: "ไพ่หลัก",
    wands: "ไม้เท้า",
    cups: "ถ้วย",
    swords: "ดาบ",
    pentacles: "เหรียญ"
  };

  var LS_KEY = "tarot_gemini_key";
  var LS_MODEL = "tarot_gemini_model";
  var DEFAULT_MODEL = "gemini-2.5-flash";

  var sectionsEl = document.getElementById("sections");
  var filterRow = document.getElementById("filterRow");
  var trayEl = document.getElementById("tray");
  var trayClearBtn = document.getElementById("trayClear");
  var askInput = document.getElementById("askInput");
  var askBtn = document.getElementById("askBtn");
  var resultBlock = document.getElementById("resultBlock");
  var resultContent = document.getElementById("resultContent");

  var apiDot = document.getElementById("apiDot");
  var apiStatusText = document.getElementById("apiStatusText");
  var apiSettingsBtn = document.getElementById("apiSettingsBtn");
  var apiOverlay = document.getElementById("apiOverlay");
  var apiClose = document.getElementById("apiClose");
  var apiKeyInput = document.getElementById("apiKeyInput");
  var apiModelInput = document.getElementById("apiModelInput");
  var apiSaveBtn = document.getElementById("apiSaveBtn");
  var apiClearBtn = document.getElementById("apiClearBtn");

  var currentFilter = "all";
  var allCards = [];
  var cardsById = {};
  var selected = []; // array of card ids, in pick order, max 3

  /* ---------------- API key settings ---------------- */

  function refreshApiStatus() {
    var key = localStorage.getItem(LS_KEY);
    if (key) {
      apiDot.classList.add("ready");
      apiStatusText.textContent = "เชื่อม Gemini API แล้ว";
    } else {
      apiDot.classList.remove("ready");
      apiStatusText.textContent = "ยังไม่ตั้งค่า Gemini API key";
    }
  }

  function openApiSettings() {
    apiKeyInput.value = localStorage.getItem(LS_KEY) || "";
    apiModelInput.value = localStorage.getItem(LS_MODEL) || DEFAULT_MODEL;
    apiOverlay.classList.add("open");
  }

  function closeApiSettings() {
    apiOverlay.classList.remove("open");
  }

  apiSettingsBtn.addEventListener("click", openApiSettings);
  apiClose.addEventListener("click", closeApiSettings);
  apiOverlay.addEventListener("click", function (e) {
    if (e.target === e.currentTarget) closeApiSettings();
  });

  apiSaveBtn.addEventListener("click", function () {
    var key = apiKeyInput.value.trim();
    var model = apiModelInput.value.trim() || DEFAULT_MODEL;
    if (!key) {
      apiKeyInput.focus();
      return;
    }
    localStorage.setItem(LS_KEY, key);
    localStorage.setItem(LS_MODEL, model);
    refreshApiStatus();
    closeApiSettings();
  });

  apiClearBtn.addEventListener("click", function () {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_MODEL);
    apiKeyInput.value = "";
    apiModelInput.value = DEFAULT_MODEL;
    refreshApiStatus();
  });

  /* ---------------- Gemini call ---------------- */

  function buildPrompt(cards, question) {
    var lines = cards.map(function (c, i) {
      return (i + 1) + ") " + c.name_en + " (" + c.name_th + ")";
    }).join("\n");

    return (
      "คุณเป็นผู้อ่านไพ่ทาโรต์ที่ให้คำทำนายด้วยน้ำเสียงอบอุ่น ให้กำลังใจ แต่ตรงไปตรงมา\n" +
      "ผู้ถามเลือกไพ่ 3 ใบตามลำดับนี้:\n" + lines + "\n\n" +
      "คำถามของผู้ถาม: \"" + question + "\"\n\n" +
      "โปรดตีความไพ่ทั้ง 3 ใบร่วมกันในบริบทของคำถามนี้โดยเฉพาะ อย่าอธิบายทีละใบแบบสารานุกรม " +
      "แต่เชื่อมโยงเป็นคำทำนายที่ลื่นไหลเป็นเรื่องเดียวกัน ตอบเป็นภาษาไทยเท่านั้น ความยาวประมาณ 150-220 คำ " +
      "แบ่งเป็น 2-3 พารากราฟสั้นๆ ไม่ต้องมีหัวข้อย่อยหรือ bullet และไม่ต้องทวนคำถามซ้ำ"
    );
  }

  function callGemini(apiKey, model, prompt) {
    var url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) +
      ":generateContent?key=" +
      encodeURIComponent(apiKey);

    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 700 }
      })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var msg = (data && data.error && data.error.message) || ("HTTP " + res.status);
          throw new Error(msg);
        }
        var cand = data.candidates && data.candidates[0];
        var parts = cand && cand.content && cand.content.parts;
        var text = parts && parts.map(function (p) { return p.text || ""; }).join("");
        if (!text) throw new Error("โมเดลไม่ได้ส่งข้อความคำทำนายกลับมา");
        return text.trim();
      });
    });
  }

  function suitKey(card) {
    return card.arcana === "major" ? "major" : card.suit.toLowerCase();
  }

  function tileHtml(card) {
    var pickIndex = selected.indexOf(card.id);
    var isSelected = pickIndex !== -1;
    var isDisabled = !isSelected && selected.length >= 3;
    var classes = "card-tile" + (isSelected ? " selected" : "") + (isDisabled ? " tile-disabled" : "");
    var badge = isSelected ? '<span class="pick-badge">' + (pickIndex + 1) + "</span>" : "";
    return (
      '<button class="' + classes + '" data-id="' + card.id + '">' +
        badge +
        '<img src="assets/cards/' + card.image + '" alt="' + card.name_en + '" loading="lazy">' +
        '<span class="tile-name">' + card.name_th + "</span>" +
      "</button>"
    );
  }

  function renderGrid() {
    var groups = {};
    SUIT_ORDER.forEach(function (k) { groups[k] = []; });
    allCards.forEach(function (c) { groups[suitKey(c)].push(c); });

    var html = "";
    SUIT_ORDER.forEach(function (key) {
      var list = groups[key];
      if (!list.length) return;
      if (currentFilter !== "all" && currentFilter !== key) return;

      html +=
        '<section class="suit-section">' +
          "<h2>" + SUIT_LABEL[key] + ' <span class="suit-count">· ' + list.length + " ใบ</span></h2>" +
          '<hr class="suit-rule">' +
          '<div class="card-grid">' +
            list.map(tileHtml).join("") +
          "</div>" +
        "</section>";
    });

    sectionsEl.innerHTML = html;
  }

  function renderTray() {
    var slots = trayEl.querySelectorAll(".tray-slot");
    slots.forEach(function (slot, i) {
      var id = selected[i];
      if (!id) {
        slot.className = "tray-slot";
        slot.innerHTML = '<span class="slot-num">' + (i + 1) + "</span>";
        return;
      }
      var card = cardsById[id];
      slot.className = "tray-slot filled";
      slot.innerHTML =
        '<img src="assets/cards/' + card.image + '" alt="' + card.name_en + '">' +
        '<button class="slot-remove" data-remove="' + id + '">✕</button>';
    });
  }

  function updateAskBtn() {
    var ready = selected.length === 3 && askInput.value.trim().length > 0;
    askBtn.disabled = !ready;
  }

  function refreshAll() {
    renderGrid();
    renderTray();
    updateAskBtn();
  }

  function toggleCard(id) {
    var idx = selected.indexOf(id);
    if (idx !== -1) {
      selected.splice(idx, 1);
    } else if (selected.length < 3) {
      selected.push(id);
    }
    refreshAll();
  }

  sectionsEl.addEventListener("click", function (e) {
    var tile = e.target.closest(".card-tile");
    if (!tile || tile.classList.contains("tile-disabled")) return;
    toggleCard(tile.getAttribute("data-id"));
  });

  trayEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".slot-remove");
    if (!btn) return;
    toggleCard(btn.getAttribute("data-remove"));
  });

  trayClearBtn.addEventListener("click", function () {
    selected = [];
    refreshAll();
  });

  filterRow.addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    currentFilter = chip.getAttribute("data-filter");
    Array.prototype.forEach.call(filterRow.querySelectorAll(".chip"), function (c) {
      c.setAttribute("aria-pressed", c === chip ? "true" : "false");
    });
    renderGrid();
  });

  askInput.addEventListener("input", updateAskBtn);

  function cardsHtml(cards) {
    return cards.map(function (c) {
      return (
        '<div class="rc">' +
          '<img src="assets/cards/' + c.image + '" alt="' + c.name_en + '">' +
          '<div class="rc-name">' + c.name_th + "</div>" +
        "</div>"
      );
    }).join("");
  }

  function paragraphsHtml(text) {
    return text.split(/\n{2,}/).map(function (p) {
      return "<p>" + p.trim().replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  function showResultLoading(cards) {
    resultContent.innerHTML =
      '<div class="result-cards">' + cardsHtml(cards) + "</div>" +
      '<div class="result-note is-loading">' +
        '<div class="loading-row"><span class="spinner"></span><span>ไพ่กำลังบอกอะไรบางอย่าง…</span></div>' +
      "</div>";
    resultBlock.hidden = false;
    resultBlock.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showResultSuccess(cards, text) {
    resultContent.innerHTML =
      '<div class="result-cards">' + cardsHtml(cards) + "</div>" +
      '<div class="result-note">' +
        paragraphsHtml(text) +
      "</div>" +
      '<p class="result-disclaimer">คำทำนายนี้มาจาก AI เพื่อการทบทวนตัวเองและความบันเทิง ไม่ใช่คำแนะนำทางการแพทย์ การเงิน หรือกฎหมาย</p>';
  }

  function showResultError(cards, message) {
    resultContent.innerHTML =
      '<div class="result-cards">' + cardsHtml(cards) + "</div>" +
      '<div class="result-note is-error">' +
        '<span class="err-title">ทำนายไม่สำเร็จ</span>' +
        "<p>" + message + "</p>" +
        "<p>ลองตรวจสอบ API key หรือชื่อโมเดลในหน้าตั้งค่า แล้วกดทำนายอีกครั้ง</p>" +
      "</div>";
  }

  askBtn.addEventListener("click", function () {
    if (selected.length !== 3 || !askInput.value.trim()) return;

    var apiKey = localStorage.getItem(LS_KEY);
    if (!apiKey) {
      openApiSettings();
      return;
    }
    var model = localStorage.getItem(LS_MODEL) || DEFAULT_MODEL;
    var cards = selected.map(function (id) { return cardsById[id]; });
    var question = askInput.value.trim();

    showResultLoading(cards);
    askBtn.disabled = true;
    askBtn.textContent = "กำลังทำนาย...";

    callGemini(apiKey, model, buildPrompt(cards, question))
      .then(function (text) {
        showResultSuccess(cards, text);
      })
      .catch(function (err) {
        showResultError(cards, err.message);
      })
      .then(function () {
        askBtn.disabled = false;
        askBtn.textContent = "ให้ไพ่ทำนาย";
      });
  });

  refreshApiStatus();

  fetch("data/cards.json")
    .then(function (r) { return r.json(); })
    .then(function (cards) {
      allCards = cards;
      cards.forEach(function (c) { cardsById[c.id] = c; });
      refreshAll();
    })
    .catch(function (err) {
      sectionsEl.innerHTML = '<p style="color:#e0679a;padding:20px 0;">โหลดข้อมูลไพ่ไม่สำเร็จ: ' + err.message + "</p>";
    });
})();
