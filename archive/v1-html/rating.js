//   const openBtn = document.getElementById('open');
//   const starOverlay = document.getElementById('starOverlay');
//   const ratingRow = document.getElementById('ratingRow');
//   const lockBtn = document.getElementById('lock');
//   const cancelBtn = document.getElementById('cancel');
//   const finalText = document.getElementById('finalText');

//   let current = 0;       // selected rating (0..5)
//   let preview = 0;       // hover/preview value
//   let locked = false;

//   // Helper: create star button (radio-like)
//   function createStar(index) {
//     const btn = document.createElement('button');
//     btn.className = 'star-btn';
//     btn.type = 'button';
//     btn.setAttribute('role', 'radio');
//     btn.setAttribute('aria-checked', 'false');
//     btn.setAttribute('aria-label', index + ' star' + (index === 1 ? '' : 's'));
//     btn.dataset.value = String(index);

//     // star SVG (uses currentColor).
//     btn.innerHTML = `
//   <svg class="star-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
//     <path d="M10 2h4v6c0 1 .5 2 1.5 2.5V22h-7V10.5C9.5 10 10 9 10 8V2z"/>
//   </svg>
// `;

//     // events
//     btn.addEventListener('click', () => {
//       if (locked) return;
//       select(index);
//       btn.focus();
//     });

//     btn.addEventListener('mouseenter', () => {
//       if (locked) return;
//       preview = index;
//       render();
//     });

//     btn.addEventListener('mouseleave', () => {
//       if (locked) return;
//       preview = 0;
//       render();
//     });

//     btn.addEventListener('focus', () => {
//       if (locked) return;
//       preview = index;
//       render();
//     });

//     btn.addEventListener('blur', () => {
//       if (locked) return;
//       preview = 0;
//       render();
//     });

//     return btn;
//   }

//   // render stars according to current/preview/locked
//   function render() {
//     const children = Array.from(ratingRow.children);
//     children.forEach((child, idx) => {
//       const value = idx + 1;
//       child.classList.remove('star-filled', 'star-preview');

//       const activeValue = preview || current;
//       if (activeValue >= value) {
//         child.classList.add('star-filled');
//         child.setAttribute('aria-checked', 'true');
//       } else {
//         child.setAttribute('aria-checked', 'false');
//       }

//       // preview highlight when hovering but not committed
//       if (!locked && preview && preview >= value) {
//         child.classList.add('star-preview');
//       }
//     });

//     // enable lock button only if a rating is selected and not locked
//     lockBtn.disabled = locked || current === 0;
//   }

//   // commit selection
//   function select(value) {
//     current = value;
//     preview = 0;
//     render();
//   }

//   // lock the rating
//   function lockRating() {
//     if (current === 0) return;
//     locked = true;
//     render();
//     // show final text
//     finalText.style.display = 'block';
//     finalText.textContent = `You rated this ${current} out of 5. Thank you!`;
//     lockBtn.disabled = true;

//     // disable all star buttons for keyboard navigation
//     ratingRow.querySelectorAll('.star-btn').forEach(b => {
//       b.disabled = true;
//       b.tabIndex = -1;
//     });

//     // optionally, do something with rating here (send to server etc.)
//     // sendRating(current);
//   }

//   // reset and close
//   function closeModal() {
//     starOverlay.style.display = 'none';
//     // reset
//     current = 0; preview = 0; locked = false;
//     finalText.style.display = 'none';
//     finalText.textContent = '';
//     lockBtn.disabled = true;
//     // reset star buttons
//     ratingRow.querySelectorAll('.star-btn').forEach(b => {
//       b.disabled = false;
//       b.tabIndex = 0;
//       b.setAttribute('aria-checked', 'false');
//     });
//     render();
//     openBtn.focus();
//   }

//   // key navigation while modal open
//   function onKeyDown(e) {
//     if (starOverlay.style.display === 'none') return;
//     // if locked, only allow Escape to close
//     if (e.key === 'Escape') {
//       e.preventDefault();
//       closeModal();
//       return;
//     }
//     if (locked) return;

//     if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
//       e.preventDefault();
//       const next = Math.min(5, (preview || current) + 1);
//       preview = next;
//       select(next);
//       focusStar(next);
//     } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
//       e.preventDefault();
//       const prev = Math.max(1, (preview || current) - 1);
//       preview = prev;
//       select(prev);
//       focusStar(prev);
//     } else if (e.key === 'Enter') {
//       e.preventDefault();
//       lockRating();
//     }
//   }

//   function focusStar(value) {
//     const btn = ratingRow.querySelector(`.star-btn[data-value="${value}"]`);
//     if (btn) btn.focus();
//   }

//   // build 5 star buttons
//   for (let i = 1; i <= 5; i++) {
//     const star = createStar(i);
//     ratingRow.appendChild(star);
//   }

//   // wire buttons
//   openBtn.addEventListener('click', () => {
//     starOverlay.style.display = 'flex';
//     // focus first star
//     setTimeout(() => focusStar(1), 40);
//   });

//   cancelBtn.addEventListener('click', () => closeModal());
 



//   // initial render
//   render();

//   // Optional: example hook to send rating to server
//   // async function sendRating(rating) {
//   //   await fetch('/submit-rating', { method:'POST', body: JSON.stringify({rating}), headers: {'Content-Type':'application/json'}});
//   // }

