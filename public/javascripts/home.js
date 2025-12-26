(function () {
      const overlay = document.getElementById('propertyOverlay');
      const content = document.getElementById('propertyContent');
      const closeBtn = document.getElementById('overlayClose');

      let currentProperty = null;
      let currentDetailsHtml = '';

      function openOverlay() {
        overlay.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
      }

      function closeOverlay() {
        overlay.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
        currentProperty = null;
        currentDetailsHtml = '';
      }

      closeBtn.addEventListener('click', closeOverlay);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeOverlay();
      });

      // --------- RENDER MAIN DETAILS (no 3D/virtual preview) ---------
      function renderMainDetails() {
        if (!currentProperty) return;
        const p = currentProperty;

        const imgHtml = (p.imageUrls && p.imageUrls.length)
          ? `<img src="${p.imageUrls[0]}" class="w-full h-72 object-cover rounded-xl mb-4 detail-image"
                data-full="${p.imageUrls[0]}" alt="property" />`
          : `<div class="w-full h-72 bg-gray-200 rounded-xl flex items-center justify-center text-gray-500 text-sm mb-4">
             No image available
           </div>`;

        const galleryHtml = (p.imageUrls && p.imageUrls.length > 1)
          ? `<div class="grid grid-cols-4 gap-2 mb-4">
             ${p.imageUrls.slice(1, 7).map(u => `
               <img src="${u}" class="w-full h-20 object-cover rounded detail-thumb"
                    data-full="${u}" alt="thumb" />
             `).join('')}
           </div>`
          : '';

        const videoHtml = (p.videoUrls && p.videoUrls.length)
          ? `<h3 class="text-lg font-semibold mt-4 mb-2">Videos</h3>
           <div class="space-y-2">
             ${p.videoUrls.slice(0, 3).map(u => `
               <video src="${u}" controls class="w-full rounded-lg max-h-64"></video>
             `).join('')}
           </div>`
          : '';

        const mapButton = p.map3dUrl
          ? `<button class="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 mr-2"
                   data-map3d="${p.map3dUrl}">
             3D View
           </button>`
          : '';

        const tourButton = p.virtualTourUrl
          ? `<button class="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
                   data-tour="${p.virtualTourUrl}">
             Virtual Tour
           </button>`
          : '';

        content.innerHTML = `
        ${imgHtml}
        ${galleryHtml}

        <h2 class="text-2xl font-bold mb-2">${p.title}</h2>
        <p class="text-gray-600 mb-1">${p.location}</p>
        <p class="text-xl font-semibold text-[#A1824C] mb-2">
          ₹ ${Number(p.price || 0).toLocaleString('en-IN')}
        </p>
        <p class="text-sm text-gray-500 mb-3">
          Suitable for: ${(p.suitableFor || []).join(', ') || 'N/A'}
        </p>
        <p class="text-sm mb-4">${p.description || ''}</p>

        <div class="mb-4">
          ${mapButton}
          ${tourButton}
        </div>

        ${videoHtml}
      `;

        currentDetailsHtml = content.innerHTML;
      }

      // --------- LOAD PROPERTY ON CARD CLICK ---------
      document.addEventListener('click', async (e) => {
        const card = e.target.closest('.property-card');
        if (!card) return;

        const id = card.getAttribute('data-id');
        if (!id) return;

        openOverlay();
        content.innerHTML = '<p class="text-center text-gray-500">Loading property...</p>';

        try {
          const res = await fetch(`/api/properties/${id}`);
          const data = await res.json();
          if (!data.ok) {
            content.innerHTML = `<p class="text-center text-red-600">${data.error || 'Failed to load property'}</p>`;
            return;
          }
          currentProperty = data.property;
          renderMainDetails();
        } catch (err) {
          console.error(err);
          content.innerHTML = '<p class="text-center text-red-600">Network error loading property.</p>';
        }
      });

      // --------- Helper: attach zoom & drag to an image element ---------
      function enableZoomAndDrag(imgEl) {
        let scale = 1;
        let originX = 0;
        let originY = 0;
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let lastX = 0;
        let lastY = 0;

        imgEl.style.cursor = 'grab';
        imgEl.style.transition = 'transform 0.08s linear'; // slightly smoother
        imgEl.style.transformOrigin = 'center center';

        function updateTransform() {
          imgEl.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
        }

        // Mouse wheel zoom (slower)
        imgEl.addEventListener('wheel', (e) => {
          e.preventDefault();
          const delta = -e.deltaY;
          const zoomFactor = delta > 0 ? 1.03 : 0.97; // was 1.1 / 0.9
          let newScale = scale * zoomFactor;

          if (newScale < 1) {
            scale = 1;
            originX = 0;
            originY = 0;
          } else if (newScale > 5) {
            scale = 5;
          } else {
            scale = newScale;
          }
          updateTransform();
        }, { passive: false });

        // Drag (mouse)
        imgEl.addEventListener('mousedown', (e) => {
          if (scale === 1) return;
          isDragging = true;
          imgEl.style.cursor = 'grabbing';
          startX = e.clientX;
          startY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          originX = lastX + dx;
          originY = lastY + dy;
          updateTransform();
        });

        window.addEventListener('mouseup', () => {
          if (!isDragging) return;
          isDragging = false;
          imgEl.style.cursor = 'grab';
          lastX = originX;
          lastY = originY;
        });

        // Touch pinch/drag (slower)
        let touchStartDist = 0;

        imgEl.addEventListener('touchstart', (e) => {
          if (e.touches.length === 1) {
            if (scale === 1) return;
            isDragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
          } else if (e.touches.length === 2) {
            isDragging = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            touchStartDist = Math.sqrt(dx * dx + dy * dy);
          }
        }, { passive: false });

        imgEl.addEventListener('touchmove', (e) => {
          e.preventDefault();
          if (e.touches.length === 1 && isDragging) {
            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;
            originX = lastX + dx;
            originY = lastY + dy;
            updateTransform();
          } else if (e.touches.length === 2 && touchStartDist) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const newDist = Math.sqrt(dx * dx + dy * dy);
            let zoomFactor = newDist / touchStartDist;

            // soften pinch speed
            zoomFactor = 1 + (zoomFactor - 1) * 0.3;

            let newScale = scale * zoomFactor;
            if (newScale < 1) newScale = 1;
            if (newScale > 5) newScale = 5;
            scale = newScale;
            touchStartDist = newDist;
            updateTransform();
          }
        }, { passive: false });

        imgEl.addEventListener('touchend', () => {
          isDragging = false;
          lastX = originX;
          lastY = originY;
          touchStartDist = 0;
        });
      }

      // --------- INSIDE OVERLAY: IMAGE EXPAND + 3D + TOUR ---------
      overlay.addEventListener('click', (e) => {
        // Expand image when clicked
        const img = e.target.closest('.detail-image, .detail-thumb');
        if (img) {
          e.stopPropagation();
          const src = img.getAttribute('data-full') || img.getAttribute('src');
          if (!src) return;

          const prevHtml = currentDetailsHtml;

          content.innerHTML = `
          <button class="back-to-details mb-3 px-3 py-1 text-sm rounded bg-gray-200 hover:bg-gray-300">
            &larr; Back
          </button>
          <div class="w-full max-h-[80vh] flex items-center justify-center overflow-hidden">
            <img id="zoomImage" src="${src}" class="max-w-full max-h-[80vh] object-contain rounded-xl" alt="image" />
          </div>
          <p class="text-xs text-gray-500 mt-2 text-center">
            Use mouse wheel or pinch to zoom, drag to move.
          </p>
        `;

          const backBtn = content.querySelector('.back-to-details');
          backBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            content.innerHTML = prevHtml;
          });

          const zoomImg = document.getElementById('zoomImage');
          if (zoomImg) enableZoomAndDrag(zoomImg);

          return;
        }

        // 3D View button
        const mapBtn = e.target.closest('button[data-map3d]');
        if (mapBtn) {
          e.stopPropagation();
          const url = mapBtn.getAttribute('data-map3d');
          const prevHtml = currentDetailsHtml;

          content.innerHTML = `
          <button class="back-to-details mb-3 px-3 py-1 text-sm rounded bg-gray-200 hover:bg-gray-300">
            &larr; Back
          </button>
          <h3 class="text-lg font-semibold mb-2">3D View</h3>
          <div class="w-full h-[70vh]">
            <iframe src="${url}" class="w-full h-full rounded-lg border"
                    loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
          </div>
        `;

          const backBtn = content.querySelector('.back-to-details');
          backBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            content.innerHTML = prevHtml;
          });

          return;
        }

        // Virtual Tour button
        const tourBtn = e.target.closest('button[data-tour]');
        if (tourBtn) {
          e.stopPropagation();
          const url = tourBtn.getAttribute('data-tour');
          const prevHtml = currentDetailsHtml;

          content.innerHTML = `
          <button class="back-to-details mb-3 px-3 py-1 text-sm rounded bg-gray-200 hover:bg-gray-300">
            &larr; Back
          </button>
          <h3 class="text-lg font-semibold mb-2">Virtual Tour</h3>
          <div class="w-full h-[70vh]">
            <iframe src="${url}" class="w-full h-full rounded-lg border"
                    allowfullscreen loading="lazy"></iframe>
          </div>
        `;

          const backBtn = content.querySelector('.back-to-details');
          backBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            content.innerHTML = prevHtml;
          });

          return;
        }
      });
    })();