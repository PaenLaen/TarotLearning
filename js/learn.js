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
  var MEANING_LABEL = { money: "การเงิน", work: "การงาน", love: "ความรัก", health: "สุขภาพ" };

  var sectionsEl = document.getElementById("sections");
  var filterRow = document.getElementById("filterRow");
  var currentFilter = "all";
  var cardsById = {};

  function suitKey(card) {
    return card.arcana === "major" ? "major" : card.suit.toLowerCase();
  }

  function tileHtml(card) {
    return (
      '<button class="card-tile" data-id="' + card.id + '">' +
        '<img src="assets/cards/' + card.image + '" alt="' + card.name_en + '" loading="lazy">' +
        '<span class="tile-name">' + card.name_th + "</span>" +
      "</button>"
    );
  }

  function render(cards) {
    var groups = {};
    SUIT_ORDER.forEach(function (k) { groups[k] = []; });
    cards.forEach(function (c) { groups[suitKey(c)].push(c); });

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

  function openDetail(card) {
    document.getElementById("detailImg").src = "assets/cards/" + card.image;
    document.getElementById("detailImg").alt = card.name_en;
    document.getElementById("detailEn").textContent = card.name_en;
    document.getElementById("detailTh").textContent = card.name_th;

    var tag = card.arcana === "major"
      ? "Major Arcana · " + card.number
      : card.suit + " · " + card.rank_en;
    document.getElementById("detailTag").textContent = tag;

    var rows = ["money", "work", "love", "health"].map(function (key) {
      var m = card.meanings[key];
      return (
        '<div class="meaning-row">' +
          '<span class="dot ' + m.level + '"></span>' +
          '<span class="label">' + MEANING_LABEL[key] + "</span>" +
          '<span class="text">' + m.text + "</span>" +
        "</div>"
      );
    }).join("");
    document.getElementById("meaningList").innerHTML = rows;

    document.getElementById("detailOverlay").classList.add("open");
  }

  function closeDetail() {
    document.getElementById("detailOverlay").classList.remove("open");
  }

  document.getElementById("detailClose").addEventListener("click", closeDetail);
  document.getElementById("detailOverlay").addEventListener("click", function (e) {
    if (e.target === e.currentTarget) closeDetail();
  });

  sectionsEl.addEventListener("click", function (e) {
    var tile = e.target.closest(".card-tile");
    if (!tile) return;
    var card = cardsById[tile.getAttribute("data-id")];
    if (card) openDetail(card);
  });

  filterRow.addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    currentFilter = chip.getAttribute("data-filter");
    Array.prototype.forEach.call(filterRow.querySelectorAll(".chip"), function (c) {
      c.setAttribute("aria-pressed", c === chip ? "true" : "false");
    });
    render(window.__ALL_CARDS__);
  });

  fetch("data/cards.json")
    .then(function (r) { return r.json(); })
    .then(function (cards) {
      window.__ALL_CARDS__ = cards;
      cards.forEach(function (c) { cardsById[c.id] = c; });
      render(cards);
    })
    .catch(function (err) {
      sectionsEl.innerHTML = '<p style="color:#e0679a;padding:20px 0;">โหลดข้อมูลไพ่ไม่สำเร็จ: ' + err.message + "</p>";
    });
})();
