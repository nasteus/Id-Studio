/**
 * ID Studio - Coala Foto de Laborator (8.9 x 12.7 cm)
 * Sincronizare Live 1:1, proportionalitate fizica exacta si layout responsive
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
    isPortrait: false,
    selectedW: 0,
    selectedH: 0
  };

  /**
   * Construieste elementul pur al colii foto cu cele 4 sloturi
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
   * Extrage dimensiunea in centimetri selectata curent in bara de comenzi
   */
  function getSelectedSizeCm() {
    var sizeDropdown = document.querySelector('.editbar-dropdown-wrapper:not(.copies-dropdown-wrapper)');
    if (sizeDropdown) {
      var txt = sizeDropdown.innerText || sizeDropdown.textContent || '';
      var match = txt.match(/([\d\.]+)\s*[×xX\:\/]\s*([\d\.]+)/);
      if (match) {
        return {
          w: parseFloat(match[1]),
          h: parseFloat(match[2])
        };
      }
    }
    return { w: 3.5, h: 4.5 };
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

    var viewportW = viewport.clientWidth;
    var viewportH = viewport.clientHeight;
    var isPortrait = (viewportH > viewportW) || window.matchMedia('(orientation: portrait)').matches;

    // In modul vertical / portabil: impartim inaltimea disponibila in jumatate
    if (isPortrait) {
      var maxHalfH = Math.floor((viewportH - 45) / 2);
      if (maxHalfH > 100) {
        cropFrame.style.maxHeight = maxHalfH + 'px';
      }
    } else {
      if (cropFrame.style.maxHeight) {
        cropFrame.style.maxHeight = '';
      }
    }

    var frameW = cropFrame.offsetWidth;
    var frameH = cropFrame.offsetHeight;
    if (frameW <= 0 || frameH <= 0) {
      requestAnimationFrame(sync);
      return;
    }

    var src = mainImg.getAttribute('src') || mainImg.src || '';
    var transform = mainImg.style.transform || '';
    var filter = mainImg.style.filter || '';
    var imgW = mainImg.style.width || '';
    var imgH = mainImg.style.height || '';

    var sizeInfo = getSelectedSizeCm();
    var selW = sizeInfo.w;
    var selH = sizeInfo.h;

    var changed = (
      src !== lastState.src ||
      transform !== lastState.transform ||
      filter !== lastState.filter ||
      frameW !== lastState.frameW ||
      frameH !== lastState.frameH ||
      imgW !== lastState.imgW ||
      imgH !== lastState.imgH ||
      isPortrait !== lastState.isPortrait ||
      selW !== lastState.selectedW ||
      selH !== lastState.selectedH
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
      lastState.selectedW = selW;
      lastState.selectedH = selH;

      // Coala are EXACT aceeasi inaltime ca chenarul de editare
      var sheetH = frameH;
      // Raportul fizic al colii este 8.9 / 12.7 ~= 0.7007874
      var sheetW = Math.round(sheetH * (8.9 / 12.7));

      sheetEl.style.height = sheetH + 'px';
      sheetEl.style.width = sheetW + 'px';

      // Determinarea dimensiunilor fizice reale ale pozei in cm (in functie de orientarea cadrului)
      var photoW_cm = selW;
      var photoH_cm = selH;
      if (frameW > frameH) {
        // Cadrul este orizontal (landscape)
        photoW_cm = Math.max(selW, selH);
        photoH_cm = Math.min(selW, selH);
      } else {
        // Cadrul este vertical (portrait)
        photoW_cm = Math.min(selW, selH);
        photoH_cm = Math.max(selW, selH);
      }

      // Raportarea exacta a pozei la coala de 8.9 x 12.7 cm
      // Daca 2 poze depasesc coala (ex: formate mari), le scalam proportional pentru a incapea pe coala
      var scaleFactor = 1.0;
      var maxAllowedW = 8.9 - 0.4;
      var maxAllowedH = 12.7 - 0.4;
      if ((2 * photoW_cm > maxAllowedW) || (2 * photoH_cm > maxAllowedH)) {
        scaleFactor = Math.min(maxAllowedW / (2 * photoW_cm), maxAllowedH / (2 * photoH_cm));
      }

      // Calculam dimensiunea in pixeli a miniaturii raportata la coala
      var slotW = Math.round(sheetW * ((photoW_cm * scaleFactor) / 8.9));
      var slotH = Math.round(sheetH * ((photoH_cm * scaleFactor) / 12.7));

      // Scalarea imaginii de la cadrul principal (frameW, frameH) la miniatura (slotW, slotH)
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
