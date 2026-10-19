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
    var initialBg = localStorage.getItem('id_studio_sheet_bg') || '#808080';
    sheet.style.setProperty('background', initialBg, 'important');
    document.documentElement.style.setProperty('--id-studio-sheet-bg', initialBg);

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
      var activePreset = localStorage.getItem('id_studio_active_preset');
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

      var photoStatesStr = localStorage.getItem('id_studio_photo_states');
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

  function isPreset(w, h, targetW, targetH) {
    return (Math.abs(w - targetW) < 0.05 && Math.abs(h - targetH) < 0.05) ||
           (Math.abs(w - targetH) < 0.05 && Math.abs(h - targetW) < 0.05);
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

      var pxPerCm = sheetH / 12.7;
      var is5x5 = isPreset(selW, selH, 5, 5);
      var is6x9 = isPreset(selW, selH, 6, 9);
      sheetEl.classList.toggle('is-size-5x5', is5x5);
      sheetEl.classList.toggle('is-size-6x9', is6x9);

      var grid = sheetEl.querySelector('.id-studio-sheet-grid');
      var slotW, slotH, scale;

      var gapPx;
      var gapCm;
      if (isPreset(selW, selH, 4, 6) || is6x9) {
        gapPx = 1;
        gapCm = gapPx / (pxPerCm || 30);
      } else if (
        isPreset(selW, selH, 2, 3) ||
        isPreset(selW, selH, 2.5, 3.2) ||
        isPreset(selW, selH, 3, 4) ||
        is5x5
      ) {
        gapCm = 1.0;
        gapPx = Math.round(gapCm * pxPerCm);
      } else if (isPreset(selW, selH, 3.5, 4.5)) {
        gapCm = 0.6;
        gapPx = Math.round(gapCm * pxPerCm);
      } else {
        gapCm = 0.5;
        gapPx = Math.round(gapCm * pxPerCm);
      }

      if (is6x9) {
        // Pentru formatul 6x9 cm:
        // Pe pagina sunt exact 2 miniaturi cu 1px distanta intre ele.
        // Miniaturile sunt rotite 90 grade la dreapta (+90° CW) si devin orizontale (9 x 6 cm).
        if (grid) {
          grid.style.setProperty('gap', '1px 0px', 'important');
          grid.style.setProperty('row-gap', '1px', 'important');
          grid.style.setProperty('column-gap', '0px', 'important');
        }

        // Miniatura orizontala are 9 cm latime (raportata la 8.9cm latimea colii)
        // si 6 cm inaltime (raportata la 12.7cm inaltimea colii).
        slotW = sheetW; // Ocupa latimea colii (8.9 cm)
        slotH = Math.round(slotW * (6.0 / 9.0)); // Inaltimea conform proportiei 6x9 (9x6 orizontal)
        scale = slotW / frameH; // Cadrul original este vertical (frameH corespunde latimii slotW rotite)

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
              scaler.style.top = '0';
              scaler.style.left = '0';
              scaler.style.transformOrigin = '0 0';
              scaler.style.transform = 'translate(' + slotW + 'px, 0px) rotate(90deg) scale(' + scale + ')';
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
      } else if (is5x5) {
        // Pentru formatul 5x5 cm:
        // Coala are 8.9 cm latime si 12.7 cm inaltime.
        // 2 miniaturi patrate de 5 x 5 cm, asezate pe o singura coloana verticala.
        // Spatiu exact de 1 cm intre ele:
        if (grid) {
          grid.style.setProperty('gap', gapPx + 'px 0px', 'important');
          grid.style.setProperty('row-gap', gapPx + 'px', 'important');
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
              scaler.style.top = '0';
              scaler.style.left = '0';
              scaler.style.transformOrigin = '0 0';
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
          grid.style.setProperty('gap', gapPx + 'px ' + gapPx + 'px', 'important');
          grid.style.setProperty('row-gap', gapPx + 'px', 'important');
          grid.style.setProperty('column-gap', gapPx + 'px', 'important');
        }

        // Raportarea exacta a pozei la coala de 8.9 x 12.7 cm
        var scaleFactor = 1.0;
        var maxAllowedW = 8.9 - gapCm;
        var maxAllowedH = 12.7 - gapCm;
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
            scaler.style.top = '0';
            scaler.style.left = '0';
            scaler.style.transformOrigin = '0 0';
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

    ensureColorPickerInTopbar();
    requestAnimationFrame(sync);
  }

  /* ========================================================
     Color Picker & Sheet Background Manager (Aperture Theme)
     ======================================================== */
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, v = max;
    var d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: s, v: v };
  }

  function hsvToRgb(h, s, v) {
    var r, g, b;
    var i = Math.floor((h / 60) % 6);
    var f = (h / 60) - Math.floor(h / 60);
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);
    switch (i) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  function hexToRgb(hex) {
    hex = (hex || '').replace('#', '').trim();
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length !== 6) return { r: 128, g: 128, b: 128 };
    var num = parseInt(hex, 16);
    if (isNaN(num)) return { r: 128, g: 128, b: 128 };
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function rgbToHex(r, g, b) {
    var bin = (r << 16) | (g << 8) | b;
    return '#' + bin.toString(16).padStart(6, '0').toUpperCase();
  }

  var PRESET_COLORS = [
    { name: 'Neutral Gray', hex: '#808080' },
    { name: 'Alb Pur', hex: '#FFFFFF' },
    { name: 'Alb Cald', hex: '#F4F4F0' },
    { name: 'Gri Deschis', hex: '#D0D0D0' },
    { name: 'Gri 18%', hex: '#777777' },
    { name: 'Gri Închis', hex: '#333333' },
    { name: 'Negru', hex: '#000000' }
  ];

  var currH = 0;
  var currS = 0;
  var currV = 0.502;
  var isPopoverOpen = false;
  var popoverEl = null;

  function updateSheetBg(hex, updateInputs) {
    if (!hex || !hex.startsWith('#')) hex = '#808080';
    hex = hex.toUpperCase();
    document.documentElement.style.setProperty('--id-studio-sheet-bg', hex);
    if (sheetEl) {
      sheetEl.style.setProperty('background', hex, 'important');
    }
    var disk = document.querySelector('.id-studio-color-disk');
    if (disk) {
      disk.style.backgroundColor = hex;
    }
    try {
      localStorage.setItem('id_studio_sheet_bg', hex);
    } catch (e) {}

    if (updateInputs && popoverEl) {
      syncPopoverUI(hex);
    }
  }

  function syncPopoverUI(hex) {
    if (!popoverEl) return;
    var previewSwatch = popoverEl.querySelector('.id-studio-popover-preview-swatch');
    if (previewSwatch) previewSwatch.style.backgroundColor = hex;

    var hexField = popoverEl.querySelector('.id-studio-hex-field');
    if (hexField && document.activeElement !== hexField) {
      hexField.value = hex.replace('#', '');
    }

    var svArea = popoverEl.querySelector('.id-studio-sv-area');
    var svThumb = popoverEl.querySelector('.id-studio-sv-thumb');
    var hueThumb = popoverEl.querySelector('.id-studio-hue-thumb');

    if (svArea) svArea.style.backgroundColor = 'hsl(' + currH + ', 100%, 50%)';
    if (svThumb) {
      svThumb.style.left = (currS * 100) + '%';
      svThumb.style.top = ((1 - currV) * 100) + '%';
      svThumb.style.backgroundColor = hex;
    }
    if (hueThumb) {
      hueThumb.style.left = ((currH / 360) * 100) + '%';
      hueThumb.style.backgroundColor = 'hsl(' + currH + ', 100%, 50%)';
    }

    // Actualizare starea chip-urilor presetate
    var chips = popoverEl.querySelectorAll('.id-studio-preset-chip');
    chips.forEach(function(chip) {
      var chipHex = chip.getAttribute('data-hex');
      if (chipHex && chipHex.toUpperCase() === hex.toUpperCase()) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  function setColorFromHex(hex) {
    var rgb = hexToRgb(hex);
    var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    currH = hsv.h;
    currS = hsv.s;
    currV = hsv.v;
    updateSheetBg(hex, true);
  }

  function applyHsvFromInteraction() {
    var rgb = hsvToRgb(currH, currS, currV);
    var hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    updateSheetBg(hex, true);
  }

  function createColorPopover(parentHole) {
    if (popoverEl) popoverEl.remove();

    popoverEl = document.createElement('div');
    popoverEl.className = 'id-studio-color-popover';

    var currentHex = localStorage.getItem('id_studio_sheet_bg') || '#808080';
    var rgb = hexToRgb(currentHex);
    var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    currH = hsv.h; currS = hsv.s; currV = hsv.v;

    // Presets HTML
    var presetsHtml = PRESET_COLORS.map(function(p) {
      var isActive = p.hex.toUpperCase() === currentHex.toUpperCase() ? ' active' : '';
      return '<button type="button" class="id-studio-preset-chip' + isActive + '" data-hex="' + p.hex + '" title="' + p.name + ' (' + p.hex + ')" style="background-color: ' + p.hex + ';"></button>';
    }).join('');

    popoverEl.innerHTML = [
      '<div class="id-studio-popover-header">',
      '  <span class="id-studio-popover-title">Culoare Fundal</span>',
      '  <button type="button" class="id-studio-neutral-gray-btn" title="Seteaz\u0103 Neutral Gray (#808080)">Neutral Gray</button>',
      '</div>',
      '<div class="id-studio-presets-row">',
      presetsHtml,
      '</div>',
      '<div class="id-studio-sv-area" style="background-color: hsl(' + currH + ', 100%, 50%);">',
      '  <div class="id-studio-sv-white"></div>',
      '  <div class="id-studio-sv-black"></div>',
      '  <div class="id-studio-sv-thumb" style="left: ' + (currS * 100) + '%; top: ' + ((1 - currV) * 100) + '%; background-color: ' + currentHex + ';"></div>',
      '</div>',
      '<div class="id-studio-hue-slider">',
      '  <div class="id-studio-hue-thumb" style="left: ' + ((currH / 360) * 100) + '%; background-color: hsl(' + currH + ', 100%, 50%);"></div>',
      '</div>',
      '<div class="id-studio-popover-bottom">',
      '  <div class="id-studio-popover-preview-swatch" style="background-color: ' + currentHex + ';"></div>',
      '  <div class="id-studio-hex-input-wrap">',
      '    <span class="id-studio-hex-hash">#</span>',
      '    <input type="text" class="id-studio-hex-field" maxlength="6" value="' + currentHex.replace('#', '') + '" spellcheck="false" />',
      '  </div>',
      '</div>'
    ].join('\n');

    // 1. Interacțiune pe SV Area (2D Saturation / Value)
    var svArea = popoverEl.querySelector('.id-studio-sv-area');
    function handleSvPointer(e) {
      var rect = svArea.getBoundingClientRect();
      var clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      var clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
      var x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      var y = Math.max(0, Math.min(rect.height, clientY - rect.top));
      currS = x / rect.width;
      currV = 1 - (y / rect.height);
      applyHsvFromInteraction();
    }

    var isDraggingSv = false;
    svArea.addEventListener('pointerdown', function(e) {
      isDraggingSv = true;
      svArea.setPointerCapture(e.pointerId);
      handleSvPointer(e);
    });
    svArea.addEventListener('pointermove', function(e) {
      if (isDraggingSv) handleSvPointer(e);
    });
    svArea.addEventListener('pointerup', function(e) {
      if (isDraggingSv) {
        isDraggingSv = false;
        try { svArea.releasePointerCapture(e.pointerId); } catch(err) {}
      }
    });

    // 2. Interacțiune pe Hue Slider
    var hueSlider = popoverEl.querySelector('.id-studio-hue-slider');
    function handleHuePointer(e) {
      var rect = hueSlider.getBoundingClientRect();
      var clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      var x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      currH = Math.round((x / rect.width) * 360);
      if (currH >= 360) currH = 359;
      applyHsvFromInteraction();
    }

    var isDraggingHue = false;
    hueSlider.addEventListener('pointerdown', function(e) {
      isDraggingHue = true;
      hueSlider.setPointerCapture(e.pointerId);
      handleHuePointer(e);
    });
    hueSlider.addEventListener('pointermove', function(e) {
      if (isDraggingHue) handleHuePointer(e);
    });
    hueSlider.addEventListener('pointerup', function(e) {
      if (isDraggingHue) {
        isDraggingHue = false;
        try { hueSlider.releasePointerCapture(e.pointerId); } catch(err) {}
      }
    });

    // 3. Preset chips
    popoverEl.querySelectorAll('.id-studio-preset-chip').forEach(function(chip) {
      chip.addEventListener('click', function(e) {
        e.stopPropagation();
        var hex = this.getAttribute('data-hex');
        if (hex) setColorFromHex(hex);
      });
    });

    // 4. Buton Neutral Gray din header
    var neutralBtn = popoverEl.querySelector('.id-studio-neutral-gray-btn');
    if (neutralBtn) {
      neutralBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        setColorFromHex('#808080');
      });
    }

    // 5. Hex field input
    var hexField = popoverEl.querySelector('.id-studio-hex-field');
    if (hexField) {
      hexField.addEventListener('input', function() {
        var clean = this.value.replace(/[^0-9A-Fa-f]/g, '');
        if (clean.length === 6) {
          setColorFromHex('#' + clean);
        }
      });
      hexField.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          var clean = this.value.replace(/[^0-9A-Fa-f]/g, '');
          if (clean.length === 3) clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
          if (clean.length === 6) setColorFromHex('#' + clean);
          closeColorPopover();
        }
      });
    }

    // Oprim propagarea click-urilor in interiorul popover-ului
    popoverEl.addEventListener('click', function(e) {
      e.stopPropagation();
    });

    parentHole.appendChild(popoverEl);
    isPopoverOpen = true;

    // Sincronizam vizual
    syncPopoverUI(currentHex);
  }

  function closeColorPopover() {
    if (popoverEl) {
      popoverEl.remove();
      popoverEl = null;
    }
    isPopoverOpen = false;
  }

  function toggleColorPopover(parentHole) {
    if (isPopoverOpen && popoverEl) {
      closeColorPopover();
    } else {
      createColorPopover(parentHole);
    }
  }

  // Închidere la click în afara ferestrei sau la tasta Escape
  document.addEventListener('click', function(e) {
    if (isPopoverOpen && popoverEl) {
      var pickerHole = document.getElementById('id-studio-bg-color-picker-hole');
      if (pickerHole && !pickerHole.contains(e.target)) {
        closeColorPopover();
      }
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isPopoverOpen) {
      closeColorPopover();
    }
  });

  function ensureColorPickerInTopbar() {
    var topbarReset = document.querySelector('.editbar-control-panel button.reset-btn');
    if (!topbarReset) return;
    var resetHole = topbarReset.closest('.hole-container');
    if (!resetHole || !resetHole.parentNode) return;

    var existing = document.getElementById('id-studio-bg-color-picker-hole');
    if (existing) {
      if (existing.nextElementSibling !== resetHole) {
        resetHole.parentNode.insertBefore(existing, resetHole);
      }
      return;
    }

    var currentBg = localStorage.getItem('id_studio_sheet_bg') || '#808080';

    var pickerHole = document.createElement('div');
    pickerHole.className = 'hole-container svelte-v18rvr id-studio-color-picker-hole';
    pickerHole.id = 'id-studio-bg-color-picker-hole';

    // Buton identic cu celelalte butoane din topbar: clasa silver-btn svelte-v18rvr
    pickerHole.innerHTML = [
      '<button type="button" class="silver-btn svelte-v18rvr id-studio-color-picker-btn" title="Culoare Fundal Coal\u0103 Foto (Neutral Gray)">',
      '  <span class="id-studio-color-disk" style="background-color: ' + currentBg + ';"></span>',
      '</button>'
    ].join('');

    var btn = pickerHole.querySelector('button');

    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      toggleColorPopover(pickerHole);
    });

    btn.addEventListener('dblclick', function(e) {
      e.preventDefault();
      e.stopPropagation();
      setColorFromHex('#808080');
    });

    if (!topbarReset.__hasColorResetListener) {
      topbarReset.__hasColorResetListener = true;
      topbarReset.addEventListener('click', function() {
        setColorFromHex('#808080');
      });
    }

    resetHole.parentNode.insertBefore(pickerHole, resetHole);
  }

  // ==========================================================================
  // ID Studio - Randare Coala 300 DPI & Integrare Cos WooCommerce
  // ==========================================================================

  function getCurrentOrderMeta() {
    var sizeInfo = getSelectedSizeCm();
    var preset = sizeInfo.w + ':' + sizeInfo.h;
    var sizeLabel = sizeInfo.w + ' \u00d7 ' + sizeInfo.h + ' cm';

    var copies = 1;
    var copiesPill = document.querySelector('.copies-preset-pill.selected, .silver-btn.copies-btn');
    if (copiesPill) {
      var cText = copiesPill.innerText || copiesPill.textContent || '';
      var cMatch = cText.match(/(\d+)/);
      if (cMatch) {
        copies = parseInt(cMatch[1], 10);
      }
    }
    if (isNaN(copies) || copies < 1) copies = 1;

    var finish = 'Lucios';
    var finishBtn = document.querySelector('.control-panel .silver-btn[title*="hartie"], .control-panel .silver-btn[title*="h\u00e2rtie"]');
    if (finishBtn) {
      var fText = (finishBtn.innerText || finishBtn.textContent || '').trim();
      if (fText.toLowerCase().indexOf('mat') !== -1) {
        finish = 'Mat';
      } else {
        finish = 'Lucios';
      }
    }

    var originalName = 'foto.jpg';
    var activeThumb = document.querySelector('.filmstrip-thumbnail.active img, .filmstrip-thumbnail img');
    if (activeThumb && activeThumb.alt) {
      originalName = activeThumb.alt;
    } else {
      var mainImg = document.querySelector('.fixed-crop-frame img.framed-photo-image');
      if (mainImg && mainImg.alt) {
        originalName = mainImg.alt;
      }
    }
    var filename = 'Foto Tip ' + sizeLabel + ' - ' + originalName;

    return {
      preset: preset,
      sizeLabel: sizeLabel,
      copies: copies,
      finish: finish,
      filename: filename
    };
  }

  function renderSheetAt300Dpi() {
    return new Promise(function(resolve, reject) {
      var cropFrame = document.querySelector('.fixed-crop-frame');
      var mainImg = cropFrame ? cropFrame.querySelector('img.framed-photo-image') : null;
      if (!cropFrame || !mainImg) {
        return reject(new Error('Nu exist\u0103 nicio fotografie deschis\u0103 \u00een editor.'));
      }

      var sizeInfo = getSelectedSizeCm();
      var selW = sizeInfo.w;
      var selH = sizeInfo.h;
      var is5x5 = isPreset(selW, selH, 5, 5);
      var is6x9 = isPreset(selW, selH, 6, 9);

      var dpi = 300;
      var pxPerCm = dpi / 2.54;

      var canvasW = 1051;
      var canvasH = 1500;

      var canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      var ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Nu s-a putut ini\u021bializa contextul Canvas 2D.'));
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Fundalul colii
      var sheetBg = localStorage.getItem('id_studio_sheet_bg') || '#808080';
      ctx.fillStyle = sheetBg;
      ctx.fillRect(0, 0, canvasW, canvasH);

      var slotsCoords = [];

      if (is6x9) {
        var slotW = canvasW;
        var slotH = Math.round(slotW * (6.0 / 9.0));
        var gap = 2;
        var totalH = (slotH * 2) + gap;
        var startY = Math.round((canvasH - totalH) / 2);

        slotsCoords.push({ x: 0, y: startY, w: slotW, h: slotH, rotate90: true });
        slotsCoords.push({ x: 0, y: startY + slotH + gap, w: slotW, h: slotH, rotate90: true });
      } else if (is5x5) {
        var slotSize = Math.round(5.0 * pxPerCm);
        var gap = Math.round(1.0 * pxPerCm);
        var totalH = (slotSize * 2) + gap;
        var startX = Math.round((canvasW - slotSize) / 2);
        var startY = Math.round((canvasH - totalH) / 2);

        slotsCoords.push({ x: startX, y: startY, w: slotSize, h: slotSize, rotate90: false });
        slotsCoords.push({ x: startX, y: startY + slotSize + gap, w: slotSize, h: slotSize, rotate90: false });
      } else {
        var slotW_cm = Math.min(selW, selH);
        var slotH_cm = Math.max(selW, selH);
        if (cropFrame.offsetWidth > cropFrame.offsetHeight) {
          slotW_cm = Math.max(selW, selH);
          slotH_cm = Math.min(selW, selH);
        }
        var slotW = Math.round(slotW_cm * pxPerCm);
        var slotH = Math.round(slotH_cm * pxPerCm);

        var gapCm = 0.5;
        var gapPx = 2;
        if (isPreset(selW, selH, 4, 6)) {
          gapPx = 2;
        } else if (isPreset(selW, selH, 2, 3) || isPreset(selW, selH, 2.5, 3.2) || isPreset(selW, selH, 3, 4)) {
          gapCm = 1.0;
          gapPx = Math.round(gapCm * pxPerCm);
        } else if (isPreset(selW, selH, 3.5, 4.5)) {
          gapCm = 0.6;
          gapPx = Math.round(gapCm * pxPerCm);
        } else {
          gapPx = Math.round(gapCm * pxPerCm);
        }

        var totalW = (slotW * 2) + gapPx;
        var totalH = (slotH * 2) + gapPx;
        var startX = Math.round((canvasW - totalW) / 2);
        var startY = Math.round((canvasH - totalH) / 2);

        slotsCoords.push({ x: startX, y: startY, w: slotW, h: slotH, rotate90: false });
        slotsCoords.push({ x: startX + slotW + gapPx, y: startY, w: slotW, h: slotH, rotate90: false });
        slotsCoords.push({ x: startX, y: startY + slotH + gapPx, w: slotW, h: slotH, rotate90: false });
        slotsCoords.push({ x: startX + slotW + gapPx, y: startY + slotH + gapPx, w: slotW, h: slotH, rotate90: false });
      }

      var frameW = cropFrame.offsetWidth;
      var frameH = cropFrame.offsetHeight;

      var imageObj = new Image();
      imageObj.crossOrigin = 'anonymous';
      imageObj.onload = function() {
        var compStyle = window.getComputedStyle(mainImg);
        var transformStr = compStyle.transform || '';
        var filterStr = compStyle.filter || '';

        var matrix = [1, 0, 0, 1, 0, 0];
        var matrixMatch = transformStr.match(/matrix\(([^)]+)\)/);
        if (matrixMatch) {
          matrix = matrixMatch[1].split(',').map(function(v) { return parseFloat(v.trim()); });
        }

        var imgW = parseFloat(mainImg.style.width) || mainImg.offsetWidth || imageObj.naturalWidth;
        var imgH = parseFloat(mainImg.style.height) || mainImg.offsetHeight || imageObj.naturalHeight;

        for (var i = 0; i < slotsCoords.length; i++) {
          var slot = slotsCoords[i];

          ctx.save();

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(slot.x, slot.y, slot.w, slot.h);

          ctx.beginPath();
          ctx.rect(slot.x, slot.y, slot.w, slot.h);
          ctx.clip();

          ctx.translate(slot.x, slot.y);

          if (slot.rotate90) {
            var scale = slot.w / frameH;
            ctx.translate(slot.w, 0);
            ctx.rotate(Math.PI / 2);
            ctx.scale(scale, scale);
          } else {
            var scale = slot.w / frameW;
            ctx.scale(scale, scale);
          }

          ctx.translate(frameW / 2, frameH / 2);
          ctx.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);

          if (filterStr && filterStr !== 'none') {
            ctx.filter = filterStr;
          }

          ctx.drawImage(imageObj, 0, 0, imgW, imgH);

          ctx.restore();

          // Muchie neagra continua slot
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
        }

        var dataUrl = canvas.toDataURL('image/jpeg', 0.98);
        resolve(dataUrl);
      };

      imageObj.onerror = function() {
        reject(new Error('Nu s-a putut \u00eenc\u0103rca imaginea pentru randare.'));
      };

      imageObj.src = mainImg.src;
    });
  }

  var orderModalEl = null;

  function showOrderModal(initialStatus, detailText) {
    if (orderModalEl && orderModalEl.parentNode) {
      orderModalEl.parentNode.removeChild(orderModalEl);
    }

    orderModalEl = document.createElement('div');
    orderModalEl.className = 'id-studio-order-backdrop';
    orderModalEl.innerHTML = [
      '<div class="id-studio-order-modal">',
      '  <div class="id-studio-order-spinner"></div>',
      '  <div class="id-studio-order-title">Procesare Comand\u0103 Foto Tip</div>',
      '  <div class="id-studio-order-status">' + (initialStatus || 'Se preg\u0103te\u0219te coala foto...') + '</div>',
      detailText ? ('  <div class="id-studio-order-detail">' + detailText + '</div>') : '',
      '</div>'
    ].join('');

    document.body.appendChild(orderModalEl);
  }

  function updateOrderStatus(statusText, detailText) {
    if (!orderModalEl) return;
    var statusEl = orderModalEl.querySelector('.id-studio-order-status');
    if (statusEl) statusEl.textContent = statusText;
    if (detailText) {
      var detailEl = orderModalEl.querySelector('.id-studio-order-detail');
      if (detailEl) {
        detailEl.textContent = detailText;
      }
    }
  }

  function showOrderError(errorMsg) {
    if (!orderModalEl) return;
    var spinner = orderModalEl.querySelector('.id-studio-order-spinner');
    if (spinner) spinner.style.display = 'none';

    var title = orderModalEl.querySelector('.id-studio-order-title');
    if (title) title.textContent = 'Eroare la ad\u0103ugare \u00een co\u0219';

    var statusEl = orderModalEl.querySelector('.id-studio-order-status');
    if (statusEl) statusEl.textContent = 'A ap\u0103rut o problem\u0103:';

    var modal = orderModalEl.querySelector('.id-studio-order-modal');
    if (modal) {
      var errBox = document.createElement('div');
      errBox.className = 'id-studio-order-error';
      errBox.textContent = errorMsg || 'Eroare necunoscut\u0103.';
      modal.appendChild(errBox);

      var closeBtn = document.createElement('button');
      closeBtn.className = 'id-studio-order-close-btn';
      closeBtn.textContent = '\u00cenchide';
      closeBtn.addEventListener('click', closeOrderModal);
      modal.appendChild(closeBtn);
    }
  }

  function closeOrderModal() {
    if (orderModalEl && orderModalEl.parentNode) {
      orderModalEl.parentNode.removeChild(orderModalEl);
      orderModalEl = null;
    }
  }

  var isOrdering = false;

  async function handleIdStudioOrder() {
    if (isOrdering) return;

    var cropFrame = document.querySelector('.fixed-crop-frame');
    var mainImg = cropFrame ? cropFrame.querySelector('img.framed-photo-image') : null;
    if (!cropFrame || !mainImg) {
      alert('V\u0103 rug\u0103m s\u0103 \u00eenc\u0103rca\u021bi o fotografie \u00eenainte de a comanda.');
      return;
    }

    var meta = getCurrentOrderMeta();
    isOrdering = true;

    showOrderModal(
      'Se genereaz\u0103 coala foto de print (300 DPI)...',
      meta.sizeLabel + ' \u2022 ' + meta.copies + ' buc. \u2022 ' + meta.finish
    );

    try {
      var dataUrl = await renderSheetAt300Dpi();

      updateOrderStatus('Se adaug\u0103 \u00een co\u0219ul de cump\u0103r\u0103turi...', 'Transfer date c\u0103tre server...');

      var resp = await fetch('/wp-json/id-studio/v1/add-to-cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          preset: meta.preset,
          copies: meta.copies,
          finish: meta.finish,
          image_data: dataUrl,
          filename: meta.filename
        })
      });

      var data = await resp.json();

      if (!resp.ok || !data || !data.success) {
        throw new Error((data && data.message) ? data.message : ('Eroare server (' + resp.status + ')'));
      }

      updateOrderStatus('Ad\u0103ugat cu succes! Redirec\u021bionare c\u0103tre co\u0219...', 'V\u0103 redirec\u021bion\u0103m \u00een co\u0219...');

      setTimeout(function() {
        window.location.href = data.redirect_url || '/cart/';
      }, 500);

    } catch (err) {
      console.error('[ID Studio] Eroare la comanda:', err);
      showOrderError(err.message || 'Nu s-a putut finaliza comanda.');
      isOrdering = false;
    }
  }

  // Interceptam apasarea butonului Moneda din bara inferioara (filmstrip)
  document.addEventListener('click', function(e) {
    var target = e.target;
    if (!target) return;

    var coinBtn = target.closest(
      '.filmstrip-action-btn.next-btn-right, ' +
      'button.next-btn-right, ' +
      'button.green-btn, ' +
      '.order-btn-icon'
    );

    if (coinBtn) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      handleIdStudioOrder();
    }
  }, true);

  // Pornire la incarcare
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      requestAnimationFrame(sync);
    });
  } else {
    requestAnimationFrame(sync);
  }
})();

