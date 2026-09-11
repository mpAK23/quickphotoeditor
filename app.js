/**
 * Fast Photo Prep & Notan Studio
 * Client-side drawing reference tool for artists
 */

(function () {
  'use strict';

  // --- State ---
  let originalImage = null; // HTMLImageElement
  let originalFileName = 'image.jpg';
  let baseName = 'image';
  let fileExt = 'jpg';
  let mimeType = 'image/jpeg';

  // Working canvas holds the current cropped, rotated, base color image
  let workingCanvas = document.createElement('canvas');
  let workingCtx = workingCanvas.getContext('2d');

  // Buffer holding the uncropped rotated image to support resetting
  let uncroppedCanvas = document.createElement('canvas');
  let uncroppedCtx = uncroppedCanvas.getContext('2d');

  // Display canvas
  const mainCanvas = document.getElementById('mainCanvas');
  const mainCtx = mainCanvas.getContext('2d');
  const gridOverlayCanvas = document.getElementById('gridOverlayCanvas');
  const gridOverlayCtx = gridOverlayCanvas.getContext('2d');

  // Notan canvases
  const notan2Canvas = document.getElementById('notan2Canvas');
  const notan2Ctx = notan2Canvas.getContext('2d');
  const notan3Canvas = document.getElementById('notan3Canvas');
  const notan3Ctx = notan3Canvas.getContext('2d');

  // DOM Elements
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const canvasStage = document.getElementById('canvasStage');
  const infoBar = document.getElementById('infoBar');
  const infoFilename = document.getElementById('infoFilename');
  const infoDimensions = document.getElementById('infoDimensions');
  const infoColorMode = document.getElementById('infoColorMode');
  const exportNameLabel = document.getElementById('exportNameLabel');

  const btnRotateCCW = document.getElementById('btnRotateCCW');
  const btnRotateCW = document.getElementById('btnRotateCW');
  const btnToggleCrop = document.getElementById('btnToggleCrop');
  const cropActionGroup = document.getElementById('cropActionGroup');
  const cropRatioSelect = document.getElementById('cropRatioSelect');
  const btnResetCrop = document.getElementById('btnResetCrop');
  const cropOverlay = document.getElementById('cropOverlay');
  const cropBox = document.getElementById('cropBox');

  const chkBW = document.getElementById('chkBW');
  const chkGrid = document.getElementById('chkGrid');
  const chkGridOnExport = document.getElementById('chkGridOnExport');
  const btnExportMain = document.getElementById('btnExportMain');

  const metaQualityHigh = document.getElementById('metaQualityHigh');
  const metaQualityMedium = document.getElementById('metaQualityMedium');
  const metaQualityLow = document.getElementById('metaQualityLow');

  // Levels & Tone DOM Elements
  const btnToggleLevels = document.getElementById('btnToggleLevels');
  const levelsPanel = document.getElementById('levelsPanel');
  const btnResetAdjustments = document.getElementById('btnResetAdjustments');
  const sliderBrightness = document.getElementById('sliderBrightness');
  const valBrightness = document.getElementById('valBrightness');
  const sliderContrast = document.getElementById('sliderContrast');
  const valContrast = document.getElementById('valContrast');
  const sliderLevelBlack = document.getElementById('sliderLevelBlack');
  const valLevelBlack = document.getElementById('valLevelBlack');
  const sliderLevelGamma = document.getElementById('sliderLevelGamma');
  const valLevelGamma = document.getElementById('valLevelGamma');
  const sliderLevelWhite = document.getElementById('sliderLevelWhite');
  const valLevelWhite = document.getElementById('valLevelWhite');

  const notan2Placeholder = document.getElementById('notan2Placeholder');
  const notan3Placeholder = document.getElementById('notan3Placeholder');
  const btnDownloadNotan2 = document.getElementById('btnDownloadNotan2');
  const btnDownloadNotan3 = document.getElementById('btnDownloadNotan3');
  const sliderNotan2 = document.getElementById('sliderNotan2');
  const valNotan2 = document.getElementById('valNotan2');
  const btnAutoNotan2 = document.getElementById('btnAutoNotan2');
  const sliderNotan3Shadow = document.getElementById('sliderNotan3Shadow');
  const valNotan3Shadow = document.getElementById('valNotan3Shadow');
  const sliderNotan3Highlight = document.getElementById('sliderNotan3Highlight');
  const valNotan3Highlight = document.getElementById('valNotan3Highlight');
  const btnAutoNotan3 = document.getElementById('btnAutoNotan3');

  // Crop State
  let isCropMode = false;
  let cropRect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }; // Normalized coordinates [0, 1] relative to stage
  let activeHandle = null;
  let dragStart = { x: 0, y: 0 };
  let initialCropRect = { ...cropRect };

  // --- File Loading ---
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  // Drag & drop handlers
  const dropTarget = document.getElementById('canvasContainer');
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropTarget.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropTarget.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropTarget.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  dropzone.addEventListener('click', () => fileInput.click());

  function handleFile(file) {
    const isJpgOrPng = file.type.match(/^image\/(jpeg|png)$/i) || /\.(jpe?g|png)$/i.test(file.name);
    if (!isJpgOrPng) {
      alert('Please select a JPG or PNG image file.');
      return;
    }

    originalFileName = file.name;
    const lastDot = file.name.lastIndexOf('.');
    if (lastDot > 0) {
      baseName = file.name.substring(0, lastDot);
      fileExt = file.name.substring(lastDot + 1).toLowerCase();
    } else {
      baseName = file.name;
      fileExt = file.type.toLowerCase().includes('png') ? 'png' : 'jpg';
    }

    mimeType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
    exportNameLabel.textContent = `${baseName}_edit.${fileExt}`;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        originalImage = img;
        initImageWorkspace(img);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function initImageWorkspace(img) {
    workingCanvas.width = img.naturalWidth;
    workingCanvas.height = img.naturalHeight;
    workingCtx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
    workingCtx.drawImage(img, 0, 0);

    // Keep uncropped copy for reset
    uncroppedCanvas.width = img.naturalWidth;
    uncroppedCanvas.height = img.naturalHeight;
    uncroppedCtx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
    uncroppedCtx.drawImage(img, 0, 0);

    dropzone.style.display = 'none';
    canvasStage.style.display = 'inline-block';
    infoBar.style.display = 'flex';
    notan2Placeholder.style.display = 'none';
    notan3Placeholder.style.display = 'none';

    exitCropMode();
    updateMainDisplay();
    autoBalanceNotans();
  }

  // --- Main Image Rendering & Pipeline ---
  function updateMainDisplay() {
    if (!workingCanvas.width || !workingCanvas.height) return;

    const w = workingCanvas.width;
    const h = workingCanvas.height;

    mainCanvas.width = w;
    mainCanvas.height = h;

    // Draw base image
    mainCtx.clearRect(0, 0, w, h);
    mainCtx.drawImage(workingCanvas, 0, 0);

    // Apply Photoshop Levels, Contrast & Brightness adjustments
    applyToneAdjustments(mainCtx, w, h);

    // Apply Black & White if checked
    if (chkBW.checked) {
      applyBWFilter(mainCtx, w, h);
      infoColorMode.textContent = 'Black & White';
    } else {
      infoColorMode.textContent = 'Color';
    }

    // Update overlay grid
    updateRuleOfThirdsGrid();

    // Update Info Bar
    infoFilename.textContent = originalFileName;
    infoDimensions.textContent = `${w} × ${h} px`;

    // Refresh Notan studies
    updateNotans();

    // Refresh export quality metadata (px dimensions & file sizes)
    updateExportQualityEstimates();
  }

  // --- Photoshop Levels, Contrast & Brightness (High-performance 256-LUT) ---
  function buildToneLUT() {
    const lut = new Uint8Array(256);
    const brightness = parseInt(sliderBrightness.value, 10); // -100 to +100
    const contrast = parseInt(sliderContrast.value, 10);     // -100 to +100
    const inBlack = parseInt(sliderLevelBlack.value, 10);    // 0 to 250
    const gamma = parseFloat(sliderLevelGamma.value);        // 0.2 to 3.0
    const inWhite = parseInt(sliderLevelWhite.value, 10);    // 5 to 255

    // Contrast multiplier formula
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const range = Math.max(1, inWhite - inBlack);
    const invGamma = 1.0 / (gamma || 1.0);

    for (let i = 0; i < 256; i++) {
      // 1. Contrast & Brightness
      let v = factor * (i - 128) + 128 + brightness;
      v = Math.max(0, Math.min(255, v));

      // 2. Photoshop Input Levels (Shadow clipping, Gamma curve, Highlight clipping)
      if (v <= inBlack) {
        v = 0;
      } else if (v >= inWhite) {
        v = 255;
      } else {
        const norm = (v - inBlack) / range;
        v = Math.pow(norm, invGamma) * 255;
      }

      lut[i] = Math.max(0, Math.min(255, Math.round(v)));
    }

    return lut;
  }

  function applyToneAdjustments(ctx, width, height) {
    const brightness = parseInt(sliderBrightness.value, 10);
    const contrast = parseInt(sliderContrast.value, 10);
    const inBlack = parseInt(sliderLevelBlack.value, 10);
    const gamma = parseFloat(sliderLevelGamma.value);
    const inWhite = parseInt(sliderLevelWhite.value, 10);

    // Skip if all values are default
    if (brightness === 0 && contrast === 0 && inBlack === 0 && Math.abs(gamma - 1.0) < 0.001 && inWhite === 255) {
      return;
    }

    const lut = buildToneLUT();
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = lut[d[i]];
      d[i + 1] = lut[d[i + 1]];
      d[i + 2] = lut[d[i + 2]];
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // Convert canvas pixel data to perceptual luminance grayscale
  function applyBWFilter(ctx, width, height) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      // Perceptual luminance formula
      const lum = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = lum;
      d[i + 1] = lum;
      d[i + 2] = lum;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // --- Rule of Thirds Grid (5px Magenta with Adaptive Scaling) ---
  const GRID_COLOR_MAGENTA = 'rgba(255, 0, 160, 0.95)';
  const GRID_BORDER_COLOR = 'rgba(0, 0, 0, 0.45)';

  // Calculate scaled grid thickness: defaults to 5px, scales down smoothly for small images/crops
  function getScaledGridThickness(width, height, baseThickness = 5) {
    const minDim = Math.min(width, height);
    if (minDim <= 0) return baseThickness;
    // If the image or viewport dimension is under 380px, scale line down so it never covers the drawing subject
    if (minDim < 380) {
      return Math.max(1, Math.round(baseThickness * (minDim / 380)));
    }
    return baseThickness;
  }

  function drawRuleOfThirds(ctx, width, height, lineWidth = 5) {
    const x1 = Math.round(width / 3);
    const x2 = Math.round((2 * width) / 3);
    const y1 = Math.round(height / 3);
    const y2 = Math.round((2 * height) / 3);

    ctx.save();
    ctx.lineCap = 'square';

    // Outer subtle contrast border for visibility on white, dark, or multi-colored photos
    ctx.strokeStyle = GRID_BORDER_COLOR;
    ctx.lineWidth = Math.max(2, lineWidth + 2);
    [x1, x2].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });
    [y1, y2].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });

    // Primary 5px Magenta rule of thirds lines
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = GRID_COLOR_MAGENTA;
    [x1, x2].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });
    [y1, y2].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });

    ctx.restore();
  }

  function updateRuleOfThirdsGrid() {
    if (!chkGrid.checked || !workingCanvas.width || !mainCanvas.clientWidth) {
      gridOverlayCanvas.width = 0;
      gridOverlayCanvas.height = 0;
      return;
    }

    const rect = mainCanvas.getBoundingClientRect();
    const displayW = Math.round(rect.width);
    const displayH = Math.round(rect.height);

    gridOverlayCanvas.width = displayW;
    gridOverlayCanvas.height = displayH;
    gridOverlayCtx.clearRect(0, 0, displayW, displayH);

    // Scale thickness adaptively for the current display size
    const scaledThickness = getScaledGridThickness(displayW, displayH, 5);
    drawRuleOfThirds(gridOverlayCtx, displayW, displayH, scaledThickness);
  }

  window.addEventListener('resize', () => {
    if (workingCanvas.width) {
      updateRuleOfThirdsGrid();
    }
  });

  // --- Export Quality Configuration & Estimation ---
  const QUALITY_SETTINGS = {
    high: { scale: 1.0, quality: 0.92, label: 'High' },
    medium: { scale: 0.75, quality: 0.78, label: 'Medium' },
    low: { scale: 0.50, quality: 0.60, label: 'Low' }
  };

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function updateExportQualityEstimates() {
    if (!workingCanvas.width || !workingCanvas.height) return;

    const baseW = mainCanvas.width;
    const baseH = mainCanvas.height;

    Object.keys(QUALITY_SETTINGS).forEach((tier) => {
      const cfg = QUALITY_SETTINGS[tier];
      const targetW = Math.max(1, Math.round(baseW * cfg.scale));
      const targetH = Math.max(1, Math.round(baseH * cfg.scale));

      const metaEl = tier === 'high' ? metaQualityHigh : tier === 'medium' ? metaQualityMedium : metaQualityLow;
      if (!metaEl) return;

      metaEl.textContent = `${targetW} × ${targetH} px • calc...`;

      // Render offscreen buffer to measure realistic compressed byte size
      const offCanvas = document.createElement('canvas');
      offCanvas.width = targetW;
      offCanvas.height = targetH;
      const offCtx = offCanvas.getContext('2d');

      offCtx.drawImage(mainCanvas, 0, 0, targetW, targetH);

      if (chkGridOnExport.checked) {
        const scaledGrid = getScaledGridThickness(targetW, targetH, Math.max(1, Math.round(5 * (Math.min(targetW, targetH) / 600))));
        drawRuleOfThirds(offCtx, targetW, targetH, scaledGrid);
      }

      offCanvas.toBlob((blob) => {
        if (blob) {
          metaEl.textContent = `${targetW} × ${targetH} px • ${formatBytes(blob.size)}`;
        }
      }, mimeType, cfg.quality);
    });
  }

  chkGridOnExport.addEventListener('change', () => {
    updateExportQualityEstimates();
  });

  // --- Rotation Handlers ---
  btnRotateCW.addEventListener('click', () => rotateWorkingImage(90));
  btnRotateCCW.addEventListener('click', () => rotateWorkingImage(-90));

  function rotateWorkingImage(degrees) {
    if (!workingCanvas.width || !workingCanvas.height) return;

    const radians = (degrees * Math.PI) / 180;
    const oldW = workingCanvas.width;
    const oldH = workingCanvas.height;

    // Create temporary buffer
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    if (Math.abs(degrees) === 90 || Math.abs(degrees) === 270) {
      tempCanvas.width = oldH;
      tempCanvas.height = oldW;
    } else {
      tempCanvas.width = oldW;
      tempCanvas.height = oldH;
    }

    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate(radians);
    tempCtx.drawImage(workingCanvas, -oldW / 2, -oldH / 2);

    workingCanvas.width = tempCanvas.width;
    workingCanvas.height = tempCanvas.height;
    workingCtx.clearRect(0, 0, workingCanvas.width, workingCanvas.height);
    workingCtx.drawImage(tempCanvas, 0, 0);

    // Also rotate uncroppedCanvas
    if (uncroppedCanvas.width) {
      const uCanvas = document.createElement('canvas');
      const uCtx = uCanvas.getContext('2d');
      if (Math.abs(degrees) === 90 || Math.abs(degrees) === 270) {
        uCanvas.width = uncroppedCanvas.height;
        uCanvas.height = uncroppedCanvas.width;
      } else {
        uCanvas.width = uncroppedCanvas.width;
        uCanvas.height = uncroppedCanvas.height;
      }
      uCtx.translate(uCanvas.width / 2, uCanvas.height / 2);
      uCtx.rotate(radians);
      uCtx.drawImage(uncroppedCanvas, -uncroppedCanvas.width / 2, -uncroppedCanvas.height / 2);
      uncroppedCanvas.width = uCanvas.width;
      uncroppedCanvas.height = uCanvas.height;
      uncroppedCtx.clearRect(0, 0, uncroppedCanvas.width, uncroppedCanvas.height);
      uncroppedCtx.drawImage(uCanvas, 0, 0);
    }

    if (isCropMode) {
      resetCropBox();
    }
    updateMainDisplay();
  }

  // --- Cropping Handlers (Double-click to apply, Reset circular arrow) ---
  btnToggleCrop.addEventListener('click', () => {
    if (!workingCanvas.width) return;
    if (isCropMode) {
      exitCropMode();
    } else {
      enterCropMode();
    }
  });

  // Always-on-screen Aspect Ratio dropdown: selecting a ratio enters crop mode and shapes the box
  cropRatioSelect.addEventListener('change', () => {
    if (!workingCanvas.width) return;
    if (!isCropMode) {
      enterCropMode();
    } else {
      adjustCropBoxForRatio();
    }
  });

  // Reset Circular Arrow: resets crop box to full or restores uncropped image if already cropped
  btnResetCrop.addEventListener('click', () => {
    if (!workingCanvas.width) return;
    
    // If workingCanvas has been cropped from original, restore uncropped image
    if (uncroppedCanvas.width && (workingCanvas.width !== uncroppedCanvas.width || workingCanvas.height !== uncroppedCanvas.height)) {
      workingCanvas.width = uncroppedCanvas.width;
      workingCanvas.height = uncroppedCanvas.height;
      workingCtx.clearRect(0, 0, workingCanvas.width, workingCanvas.height);
      workingCtx.drawImage(uncroppedCanvas, 0, 0);
      updateMainDisplay();
    }

    cropRatioSelect.value = 'free';
    resetCropBox();
    if (!isCropMode) {
      enterCropMode();
    }
  });

  // Double-clicking on cropBox or cropOverlay applies the crop
  cropBox.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    applyCrop();
    exitCropMode();
  });

  cropOverlay.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    applyCrop();
    exitCropMode();
  });

  // Double-clicking on mainCanvas enters crop mode or applies crop
  mainCanvas.addEventListener('dblclick', (e) => {
    if (!workingCanvas.width) return;
    if (isCropMode) {
      applyCrop();
      exitCropMode();
    } else {
      enterCropMode();
    }
  });

  function enterCropMode() {
    isCropMode = true;
    btnToggleCrop.classList.add('active');
    cropOverlay.classList.remove('hidden');
    resetCropBox();
  }

  function exitCropMode() {
    isCropMode = false;
    btnToggleCrop.classList.remove('active');
    cropOverlay.classList.add('hidden');
  }

  function resetCropBox() {
    cropRect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    adjustCropBoxForRatio();
    renderCropBox();
  }

  function renderCropBox() {
    cropBox.style.left = `${cropRect.x * 100}%`;
    cropBox.style.top = `${cropRect.y * 100}%`;
    cropBox.style.width = `${cropRect.w * 100}%`;
    cropBox.style.height = `${cropRect.h * 100}%`;
  }

  function adjustCropBoxForRatio() {
    const ratioVal = cropRatioSelect.value;
    if (ratioVal === 'free' || !workingCanvas.width || !workingCanvas.height) {
      renderCropBox();
      return;
    }

    const [rw, rh] = ratioVal.split(':').map(Number);
    const targetRatio = rw / rh;
    const stageRatio = workingCanvas.width / workingCanvas.height;

    // Convert target ratio to normalized space (w / h in normalized coordinates)
    const normalizedTargetRatio = targetRatio / stageRatio;

    let newW = cropRect.w;
    let newH = newW / normalizedTargetRatio;

    if (newH > 0.95) {
      newH = 0.95;
      newW = newH * normalizedTargetRatio;
    }
    if (newW > 0.95) {
      newW = 0.95;
      newH = newW / normalizedTargetRatio;
    }

    cropRect.w = newW;
    cropRect.h = newH;
    cropRect.x = Math.max(0, Math.min(1 - newW, cropRect.x));
    cropRect.y = Math.max(0, Math.min(1 - newH, cropRect.y));
    renderCropBox();
  }

  // Crop interaction (drag move & resize)
  function handleDragStart(clientX, clientY, target) {
    if (target.dataset.handle) {
      activeHandle = target.dataset.handle;
    } else {
      activeHandle = 'move';
    }
    dragStart = { x: clientX, y: clientY };
    initialCropRect = { ...cropRect };
  }

  function handleDragMove(clientX, clientY) {
    if (!activeHandle || !isCropMode) return;

    const overlayRect = cropOverlay.getBoundingClientRect();
    if (!overlayRect.width || !overlayRect.height) return;

    const deltaX = (clientX - dragStart.x) / overlayRect.width;
    const deltaY = (clientY - dragStart.y) / overlayRect.height;

    let { x, y, w, h } = initialCropRect;

    if (activeHandle === 'move') {
      x = Math.max(0, Math.min(1 - w, x + deltaX));
      y = Math.max(0, Math.min(1 - h, y + deltaY));
    } else {
      if (activeHandle.includes('e')) {
        w = Math.max(0.05, Math.min(1 - x, w + deltaX));
      }
      if (activeHandle.includes('w')) {
        const potentialW = w - deltaX;
        if (potentialW >= 0.05 && x + deltaX >= 0) {
          x += deltaX;
          w = potentialW;
        }
      }
      if (activeHandle.includes('s')) {
        h = Math.max(0.05, Math.min(1 - y, h + deltaY));
      }
      if (activeHandle.includes('n')) {
        const potentialH = h - deltaY;
        if (potentialH >= 0.05 && y + deltaY >= 0) {
          y += deltaY;
          h = potentialH;
        }
      }

      // If aspect ratio is locked and resizing from corner
      if (cropRatioSelect.value !== 'free' && activeHandle.length === 2) {
        const [rw, rh] = cropRatioSelect.value.split(':').map(Number);
        const stageRatio = workingCanvas.width / workingCanvas.height;
        const normRatio = (rw / rh) / stageRatio;
        h = w / normRatio;
        if (y + h > 1) {
          h = 1 - y;
          w = h * normRatio;
        }
      }
    }

    cropRect = { x, y, w, h };
    renderCropBox();
  }

  function handleDragEnd() {
    activeHandle = null;
  }

  cropBox.addEventListener('mousedown', (e) => {
    handleDragStart(e.clientX, e.clientY, e.target);
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener('mousemove', (e) => {
    handleDragMove(e.clientX, e.clientY);
  });

  window.addEventListener('mouseup', handleDragEnd);

  // Touch support for mobile / tablets
  cropBox.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
      e.preventDefault();
      e.stopPropagation();
    }
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && activeHandle) {
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('touchend', handleDragEnd);
  window.addEventListener('touchcancel', handleDragEnd);

  function applyCrop() {
    const srcX = Math.round(cropRect.x * workingCanvas.width);
    const srcY = Math.round(cropRect.y * workingCanvas.height);
    const srcW = Math.max(1, Math.round(cropRect.w * workingCanvas.width));
    const srcH = Math.max(1, Math.round(cropRect.h * workingCanvas.height));

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = srcW;
    croppedCanvas.height = srcH;
    const croppedCtx = croppedCanvas.getContext('2d');

    croppedCtx.drawImage(workingCanvas, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

    workingCanvas.width = srcW;
    workingCanvas.height = srcH;
    workingCtx.clearRect(0, 0, srcW, srcH);
    workingCtx.drawImage(croppedCanvas, 0, 0);

    updateMainDisplay();
  }

  // --- Adjustments & Checkbox Events ---
  chkBW.addEventListener('change', updateMainDisplay);
  chkGrid.addEventListener('change', updateRuleOfThirdsGrid);

  // --- Notan Generators ---
  function updateNotans() {
    if (!workingCanvas.width || !workingCanvas.height) return;

    render2ValueNotan();
    render3ValueNotan();
  }

  function render2ValueNotan() {
    const w = workingCanvas.width;
    const h = workingCanvas.height;
    notan2Canvas.width = w;
    notan2Canvas.height = h;

    // Use current mainCanvas pixels (takes crop, rotation, levels, and tone adjustments)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(mainCanvas, 0, 0);

    const imgData = tempCtx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const threshold = parseInt(sliderNotan2.value, 10);

    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const val = lum < threshold ? 0 : 255;
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
      d[i + 3] = 255;
    }

    notan2Ctx.putImageData(imgData, 0, 0);
  }

  function render3ValueNotan() {
    const w = workingCanvas.width;
    const h = workingCanvas.height;
    notan3Canvas.width = w;
    notan3Canvas.height = h;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(mainCanvas, 0, 0);

    const imgData = tempCtx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const shadowThresh = parseInt(sliderNotan3Shadow.value, 10);
    const highlightThresh = parseInt(sliderNotan3Highlight.value, 10);

    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let val;
      if (lum < shadowThresh) {
        val = 0; // Pure Black
      } else if (lum < highlightThresh) {
        val = 128; // Midtone 50% Gray
      } else {
        val = 255; // Pure White
      }
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
      d[i + 3] = 255;
    }

    notan3Ctx.putImageData(imgData, 0, 0);
  }

  // Auto Balance calculations (Otsu's threshold & 33%/66% percentiles)
  function computeLuminanceHistogram() {
    if (!workingCanvas.width) return null;

    const w = workingCanvas.width;
    const h = workingCanvas.height;
    const tempCanvas = document.createElement('canvas');
    // Sample down for fast histogram calculation
    const sampleW = Math.min(300, w);
    const sampleH = Math.min(300, h);
    tempCanvas.width = sampleW;
    tempCanvas.height = sampleH;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(mainCanvas, 0, 0, sampleW, sampleH);

    const data = tempCtx.getImageData(0, 0, sampleW, sampleH).data;
    const totalPixels = sampleW * sampleH;
    const histogram = new Array(256).fill(0);

    for (let i = 0; i < data.length; i += 4) {
      const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      histogram[lum]++;
    }

    return { histogram, totalPixels };
  }

  // Auto Balance 2-Value Notan independently (Otsu's threshold)
  function autoBalanceNotan2() {
    const histData = computeLuminanceHistogram();
    if (!histData) return;

    const { histogram, totalPixels } = histData;

    // Otsu threshold for 2-Value Notan
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * histogram[t];

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let varMax = 0;
    let otsuThresh = 128;

    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      wF = totalPixels - wB;
      if (wF === 0) break;

      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const varBetween = wB * wF * (mB - mF) * (mB - mF);

      if (varBetween > varMax) {
        varMax = varBetween;
        otsuThresh = t;
      }
    }

    sliderNotan2.value = otsuThresh;
    valNotan2.textContent = otsuThresh;
    render2ValueNotan();
  }

  // Auto Balance 3-Value Notan independently (33% and 66% percentiles)
  function autoBalanceNotan3() {
    const histData = computeLuminanceHistogram();
    if (!histData) return;

    const { histogram, totalPixels } = histData;

    // 33% and 66% percentiles for 3-Value Notan
    let cum = 0;
    let p33 = 85;
    let p66 = 170;
    for (let t = 0; t < 256; t++) {
      cum += histogram[t];
      if (cum >= totalPixels * 0.33 && p33 === 85) {
        p33 = Math.max(20, Math.min(140, t));
      }
      if (cum >= totalPixels * 0.66 && p66 === 170) {
        p66 = Math.max(p33 + 15, Math.min(235, t));
        break;
      }
    }

    sliderNotan3Shadow.value = p33;
    valNotan3Shadow.textContent = p33;

    sliderNotan3Highlight.value = p66;
    valNotan3Highlight.textContent = p66;

    render3ValueNotan();
  }

  // Initial load balances both
  function autoBalanceNotans() {
    autoBalanceNotan2();
    autoBalanceNotan3();
  }

  // --- Levels & Tone Event Listeners ---
  btnToggleLevels.addEventListener('click', () => {
    levelsPanel.classList.toggle('hidden');
    btnToggleLevels.classList.toggle('active', !levelsPanel.classList.contains('hidden'));
  });

  sliderBrightness.addEventListener('input', () => {
    valBrightness.textContent = sliderBrightness.value;
    updateMainDisplay();
  });

  sliderContrast.addEventListener('input', () => {
    valContrast.textContent = sliderContrast.value;
    updateMainDisplay();
  });

  sliderLevelBlack.addEventListener('input', () => {
    let b = parseInt(sliderLevelBlack.value, 10);
    let w = parseInt(sliderLevelWhite.value, 10);
    if (b >= w) {
      sliderLevelWhite.value = b + 5;
      valLevelWhite.textContent = sliderLevelWhite.value;
    }
    valLevelBlack.textContent = b;
    updateMainDisplay();
  });

  sliderLevelGamma.addEventListener('input', () => {
    valLevelGamma.textContent = parseFloat(sliderLevelGamma.value).toFixed(2);
    updateMainDisplay();
  });

  sliderLevelWhite.addEventListener('input', () => {
    let b = parseInt(sliderLevelBlack.value, 10);
    let w = parseInt(sliderLevelWhite.value, 10);
    if (w <= b) {
      sliderLevelBlack.value = Math.max(0, w - 5);
      valLevelBlack.textContent = sliderLevelBlack.value;
    }
    valLevelWhite.textContent = w;
    updateMainDisplay();
  });

  btnResetAdjustments.addEventListener('click', () => {
    sliderBrightness.value = 0;
    valBrightness.textContent = '0';
    sliderContrast.value = 0;
    valContrast.textContent = '0';
    sliderLevelBlack.value = 0;
    valLevelBlack.textContent = '0';
    sliderLevelGamma.value = 1.0;
    valLevelGamma.textContent = '1.00';
    sliderLevelWhite.value = 255;
    valLevelWhite.textContent = '255';
    updateMainDisplay();
  });

  // Slider events
  sliderNotan2.addEventListener('input', () => {
    valNotan2.textContent = sliderNotan2.value;
    render2ValueNotan();
  });

  btnAutoNotan2.addEventListener('click', autoBalanceNotan2);

  sliderNotan3Shadow.addEventListener('input', () => {
    let sVal = parseInt(sliderNotan3Shadow.value, 10);
    let hVal = parseInt(sliderNotan3Highlight.value, 10);
    if (sVal >= hVal) {
      sliderNotan3Highlight.value = sVal + 5;
      valNotan3Highlight.textContent = sliderNotan3Highlight.value;
    }
    valNotan3Shadow.textContent = sVal;
    render3ValueNotan();
  });

  sliderNotan3Highlight.addEventListener('input', () => {
    let sVal = parseInt(sliderNotan3Shadow.value, 10);
    let hVal = parseInt(sliderNotan3Highlight.value, 10);
    if (hVal <= sVal) {
      sliderNotan3Shadow.value = hVal - 5;
      valNotan3Shadow.textContent = sliderNotan3Shadow.value;
    }
    valNotan3Highlight.textContent = hVal;
    render3ValueNotan();
  });

  btnAutoNotan3.addEventListener('click', autoBalanceNotan3);

  // --- Downloads & Exporting ---
  function downloadCanvas(canvas, filename, quality = 0.95) {
    if (!canvas || !canvas.width || !canvas.height) {
      alert('No image loaded yet to export.');
      return;
    }

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL(mimeType, quality);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 1. Export Main Image: original name + _edit (respecting quality choice and scaled grid)
  btnExportMain.addEventListener('click', () => {
    if (!workingCanvas.width) return;

    const selectedQuality = document.querySelector('input[name="exportQuality"]:checked')?.value || 'high';
    const cfg = QUALITY_SETTINGS[selectedQuality] || QUALITY_SETTINGS.high;

    const exportW = Math.max(1, Math.round(mainCanvas.width * cfg.scale));
    const exportH = Math.max(1, Math.round(mainCanvas.height * cfg.scale));

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportW;
    exportCanvas.height = exportH;
    const exportCtx = exportCanvas.getContext('2d');

    // Draw main image at target scale
    exportCtx.drawImage(mainCanvas, 0, 0, exportW, exportH);

    // If Include in Export is checked, draw scaled 5px magenta grid
    if (chkGridOnExport.checked) {
      const exportGridThickness = getScaledGridThickness(exportW, exportH, Math.max(1, Math.round(5 * (Math.min(exportW, exportH) / 600))));
      drawRuleOfThirds(exportCtx, exportW, exportH, exportGridThickness);
    }

    const exportFilename = `${baseName}_edit.${fileExt}`;
    downloadCanvas(exportCanvas, exportFilename, cfg.quality);
  });

  // 2. Download 2-Value Notan: original name + _notan2
  btnDownloadNotan2.addEventListener('click', () => {
    if (!workingCanvas.width) return;
    const filename = `${baseName}_notan2.${fileExt}`;
    downloadCanvas(notan2Canvas, filename);
  });

  // 3. Download 3-Value Notan: original name + _notan3
  btnDownloadNotan3.addEventListener('click', () => {
    if (!workingCanvas.width) return;
    const filename = `${baseName}_notan3.${fileExt}`;
    downloadCanvas(notan3Canvas, filename);
  });

})();
