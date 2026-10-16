/**
 * ID Studio - Coala Foto de Laborator (8.9 x 12.7 cm)
 * Sincronizare Live pura: doar coala cu cele 4 miniaturi, fara elemente parazite.
 */
(function() {
  'use strict';

  var sheetEl = null;
  var slotScalers = [];
  var slotImgs = [];
  var slots = [];
  var lastState = {
    src: '',
    transform: '',
    filter: '',
    frameW: 0,
    frameH: 0,
    imgW: '',
    imgH: '',
    isPortrait: false
  };

  /**
   * Construieste elementul pur al colii foto (8.9 x 12.7 cm) cu cele 4 sloturi
   */
  function createSheet() {
    var sheet = document.createElement('div');
    sheet.className = 'id-studio-sheet';
    sheet.innerHTML = [
      '<div class="id-studio-sheet-grid">',
      '  <div class="id-studio-photo-slot" data-slot="0"><div class="id-studio-slot-scaler"><img draggable="false" /></div></div>',
      '  <div class="id-studio-photo-slot" data-slot="1"><div class="id-studio-slot-scaler"><img draggable="false" /></div></div>',
      '  <div class="id-studio-photo-slot" data-slot="2"><div class="id-studio-slot-scaler"><img draggable="false" /></div></div>',
      '  <div class="id-studio-photo-slot" data-slot="3"><div class="id-studio-slot-scaler"><img draggable="false" /></div></div>',
      '</div>'
    ].join('\n');

    slots = Array.from(sheet.querySelectorAll('.id-studio-photo-slot'));
    slotScalers = Array.from(sheet.querySelectorAll('.id-studio-slot-scaler'));
    slotImgs = Array.from(sheet.querySelectorAll('.id-studio-slot-scaler img'));

    return sheet;
  }

  /**
   * Bucla de sincronizare continua (60 FPS)
   */
  function sync() {
    var cropFrame = document.querySelector('.fixed-crop-frame');
    var viewport = document.querySelector('.canvas-viewport');

    // Daca nu exista poza deschisa sau viewport
    if (!cropFrame || !viewport) {
      if (sheetEl && sheetEl.parentNode) {
        sheetEl.parentNode.removeChild(sheetEl);
        sheetEl = null;
      }
      requestAnimationFrame(sync);
      return;
    }

    // Creeaza si ataseaza coala direct in viewport, langa cropFrame
    if (!sheetEl || !sheetEl.parentNode || sheetEl.parentNode !== viewport) {
      if (!sheetEl) {
        sheetEl = createSheet();
      }
      viewport.appendChild(sheetEl);
    }

    var mainImg = cropFrame.querySelector('img.framed-photo-image');
    if (!mainImg) {
      requestAnimationFrame(sync);
      return;
    }

    var frameW = cropFrame.offsetWidth;
    var frameH = cropFrame.offsetHeight;
    if (frameW <= 0 || frameH <= 0) {
      requestAnimationFrame(sync);
      return;
    }

    var viewportW = viewport.clientWidth;
    var viewportH = viewport.clientHeight;
    var isPortrait = (viewportH > viewportW) || window.matchMedia('(orientation: portrait)').matches;

    // Ajustare pentru modul portabil / vertical: impartirea inaltimii in jumatate
    if (isPortrait) {
      // Inaltimea maxima disponibila pentru fiecare din cele doua elemente
      var maxHalfH = Math.floor((viewportH - 40) / 2);
      if (maxHalfH > 100) {
        cropFrame.style.maxHeight = maxHalfH + 'px';
        frameW = cropFrame.offsetWidth;
        frameH = cropFrame.offsetHeight;
      }
    } else {
      if (cropFrame.style.maxHeight) {
        cropFrame.style.maxHeight = '';
        frameW = cropFrame.offsetWidth;
        frameH = cropFrame.offsetHeight;
      }
    }

    var src = mainImg.getAttribute('src') || mainImg.src || '';
    var transform = mainImg.style.transform || '';
    var filter = mainImg.style.filter || '';
    var imgW = mainImg.style.width || '';
    var imgH = mainImg.style.height || '';

    var changed = (
      src !== lastState.src ||
      transform !== lastState.transform ||
      filter !== lastState.filter ||
      frameW !== lastState.frameW ||
      frameH !== lastState.frameH ||
      imgW !== lastState.imgW ||
      imgH !== lastState.imgH ||
      isPortrait !== lastState.isPortrait
    );

    if (changed) {
      lastState.src = src;
      lastState.transform = transform;
      lastState.filter = filter;
      lastState.frameW = frameW;
      lastState.frameH = frameH;
      lastState.imgW = imgW;
      lastState.imgH = imgH;
      lastState.isPortrait = isPortrait;

      // Coala are EXACT aceeasi inaltime ca si chenarul de editare
      var targetSheetH = frameH;
      // Raportul fizic al colii este 8.9 / 12.7 ~= 0.700787
      var targetSheetW = Math.round(targetSheetH * (8.9 / 12.7));

      sheetEl.style.height = targetSheetH + 'px';
      sheetEl.style.width = targetSheetW + 'px';

      // Calculam dimensiunile celor 4 miniaturi cu raportul exact al chenarului
      var ratio = frameW / frameH;
      var gapX = 8;
      var gapY = 8;

      // Incadram optim cele 4 poze in gridul 2x2 pe suprafata colii
      var maxSlotH = (targetSheetH * 0.94 - gapY) / 2;
      var maxSlotW = (targetSheetW * 0.94 - gapX) / 2;

      var slotH = Math.floor(Math.min(maxSlotH, maxSlotW / ratio));
      var slotW = Math.floor(slotH * ratio);

      var scale = slotW / frameW;

      for (var i = 0; i < slots.length; i++) {
        var slot = slots[i];
        slot.style.width = slotW + 'px';
        slot.style.height = slotH + 'px';

        var scaler = slotScalers[i];
        if (scaler) {
          scaler.style.width = frameW + 'px';
          scaler.style.height = frameH + 'px';
          scaler.style.transform = 'scale(' + scale + ')';
        }

        var img = slotImgs[i];
        if (img) {
          if (img.getAttribute('src') !== src) {
            img.setAttribute('src', src);
          }
          img.style.width = imgW;
          img.style.height = imgH;
          img.style.transform = transform;
          img.style.transformOrigin = mainImg.style.transformOrigin || 'center center';
          img.style.filter = filter;
        }
      }
    }

    requestAnimationFrame(sync);
  }

  // Pornire la incarcare
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      requestAnimationFrame(sync);
    });
  } else {
    requestAnimationFrame(sync);
  }
})();
