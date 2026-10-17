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

  var cachedSize = { w: 3.5, h: 4.5 };

  /**
   * Extrage dimensiunea in centimetri selectata curent in bara de comenzi
   */
  function getSelectedSizeCm() {
    // 1. Incercam citirea din DOM din elementul dropdown
    var sizeDropdown = document.querySelector('.editbar-dropdown-wrapper:not(.copies-dropdown-wrapper)');
    if (sizeDropdown) {
      var txt = sizeDropdown.innerText || sizeDropdown.textContent || '';
      var match = txt.match(/([\d\.]+)\s*[×xX\:\/]\s*([\d\.]+)/);
      if (match) {
        cachedSize = {
          w: parseFloat(match[1]),
          h: parseFloat(match[2])
        };
        return cachedSize;
      }
    }

    // 2. Incercam citirea din starea persistata de Svelte in localStorage
    try {
      var activePreset = localStorage.getItem('crop_studio_active_preset');
      if (activePreset) {
        var pMatch = activePreset.match(/([\d\.]+)\s*[:xX×]\s*([\d\.]+)/);
        if (pMatch) {
          cachedSize = {
            w: parseFloat(pMatch[1]),
            h: parseFloat(pMatch[2])
          };
          return cachedSize;
        }
      }

      var photoStatesStr = localStorage.getItem('crop_studio_photo_states');
      if (photoStatesStr) {
        var states = JSON.parse(photoStatesStr);
        for (var k in states) {
          if (states[k] && states[k].preset) {
            var sMatch = states[k].preset.match(/([\d\.]+)\s*[:xX×]\s*([\d\.]+)/);
            if (sMatch) {
              cachedSize = {
                w: parseFloat(sMatch[1]),
                h: parseFloat(sMatch[2])
              };
              return cachedSize;
            }
          }
        }
      }
    } catch (e) {}

    // 3. Pastram dimensiunea valida anterioara (nu revenim niciodata involuntar la 3.5x4.5)
    return cachedSize;
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

      var is5x5 = (selW === 5 && selH === 5);
      sheetEl.classList.toggle('is-size-5x5', is5x5);

      var grid = sheetEl.querySelector('.id-studio-sheet-grid');
      var slotW, slotH, scale;

      if (is5x5) {
        // Pentru formatul 5x5 cm:
        // Coala are 8.9 cm latime si 12.7 cm inaltime.
        // 2 miniaturi patrate de 5 x 5 cm, asezate pe o singura coloana verticala.
        // Spatiu exact de 1 cm intre ele:
        var gapY = Math.round(sheetH * (1.0 / 12.7));
        if (grid) {
          grid.style.setProperty('gap', gapY + 'px 0px', 'important');
          grid.style.setProperty('row-gap', gapY + 'px', 'important');
          grid.style.setProperty('column-gap', '0px', 'important');
        }

        // Marimea miniaturii raportata la coala fizica (5cm raportat la 12.7cm inaltime)
        slotH = Math.round(sheetH * (5.0 / 12.7));
        slotW = slotH; // Este patrat perfect 5x5 cm
        scale = slotW / frameW;

        for (var i = 0; i < slots.length; i++) {
          var slot = slots[i];
          if (i < 2) {
            slot.style.display = '';
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
          } else {
            slot.style.display = 'none';
          }
        }
      } else {
        if (grid) {
          grid.style.setProperty('gap', '6px 6px', 'important');
          grid.style.setProperty('row-gap', '6px', 'important');
          grid.style.setProperty('column-gap', '6px', 'important');
        }

        // Raportarea exacta a pozei la coala de 8.9 x 12.7 cm
        var scaleFactor = 1.0;
        var maxAllowedW = 8.9 - 0.4;
        var maxAllowedH = 12.7 - 0.4;
        if ((2 * photoW_cm > maxAllowedW) || (2 * photoH_cm > maxAllowedH)) {
          scaleFactor = Math.min(maxAllowedW / (2 * photoW_cm), maxAllowedH / (2 * photoH_cm));
        }

        // Calculam dimensiunea in pixeli a miniaturii raportata la coala
        slotW = Math.round(sheetW * ((photoW_cm * scaleFactor) / 8.9));
        slotH = Math.round(sheetH * ((photoH_cm * scaleFactor) / 12.7));
        scale = slotW / frameW;

        for (var i = 0; i < slots.length; i++) {
          var slot = slots[i];
          slot.style.display = '';
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
