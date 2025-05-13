// script.js
const form    = document.getElementById('checker-form');
const input   = document.getElementById('ingredients');
const results = document.getElementById('results');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const ing = input.value.trim();
  if (!ing) {
    results.textContent = '⚠️ Please enter at least one ingredient.';
    results.className = 'error';
    return;
  }

  // show loading state
  results.textContent = '⏳ Checking…';
  results.className = '';

  try {
    // ←– point to your local API
    const res = await fetch('http://localhost:3000/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients: ing }),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const data = await res.json();

    // render the results
    results.innerHTML = data.map(item => `
      <div class="item">
        <strong>${item.name}</strong><br>
        Comedogenic Rating: ${item.comedogenic_rating} &nbsp;|&nbsp;
        Sensitivity Risk: ${item.sensitivity_risk}<br>
        Function: ${item.function}<br>
        Notes: ${item.notes}
      </div>
    `).join('');

  } catch (err) {
    console.error(err);
    results.textContent = '❌ Error: Load failed';
    results.className = 'error';
  }
});


